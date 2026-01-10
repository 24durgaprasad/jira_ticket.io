import { NextRequest, NextResponse } from 'next/server';
import { extractTextFromImage } from '@/lib/ocr';
import { runAIAnalysis } from '@/lib/ai';
import {
    createJiraIssue,
    linkJiraIssues,
    EPIC_ISSUE_TYPE_NAME,
    STORY_ISSUE_TYPE_NAME,
    EPIC_NAME_FIELD_ID,
    EPIC_LINK_FIELD_ID,
    toADF
} from '@/lib/jira';
import { GenerateTicketsSchema, JiraIssueFields, AIAnalysisResult } from '@/lib/types';

// Allow longer timeout for this route if deployed to Vercel Pro or Node setup
export const maxDuration = 60;

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();

        let jiraUrlInput = formData.get('jiraUrl') as string;
        if (jiraUrlInput && !jiraUrlInput.startsWith('http')) {
            jiraUrlInput = `https://${jiraUrlInput}`;
        }

        // Validate fields using Zod
        const rawBody = {
            jiraUrl: jiraUrlInput,
            projectKey: formData.get('projectKey'),
            email: formData.get('email'),
            apiToken: formData.get('apiToken'),
        };

        const validationResult = GenerateTicketsSchema.safeParse(rawBody);

        if (!validationResult.success) {
            return NextResponse.json(
                { message: 'Validation Error', errors: validationResult.error.format() },
                { status: 400 }
            );
        }

        const { jiraUrl, projectKey, email, apiToken } = validationResult.data;
        const file = formData.get('requirementsFile') as File | null;

        if (!file) {
            return NextResponse.json(
                { message: 'Missing requirements file.' },
                { status: 400 }
            );
        }

        // 1. Extract Text
        let requirementsText = '';
        const buffer = Buffer.from(await file.arrayBuffer());

        if (file.type.startsWith('image/')) {
            requirementsText = await extractTextFromImage(buffer);
        } else {
            requirementsText = buffer.toString('utf-8');
        }

        // 2. AI Analysis
        const structuredData = await runAIAnalysis(requirementsText) as AIAnalysisResult;

        // 3. Create Jira Issues

        const uploadTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const parentEpicSummary = `Requirements Upload - ${uploadTimestamp}`;
        const parentEpicDescription = `Parent epic grouping all epics and stories generated from requirements document uploaded on ${new Date().toLocaleString()}.`;

        const parentEpicFields: JiraIssueFields = {
            project: { key: projectKey },
            summary: parentEpicSummary,
            description: toADF(parentEpicDescription),
            issuetype: { name: EPIC_ISSUE_TYPE_NAME },
            labels: [`upload-${uploadTimestamp}`],
        };

        if (EPIC_NAME_FIELD_ID && EPIC_NAME_FIELD_ID !== 'skip') {
            parentEpicFields[EPIC_NAME_FIELD_ID] = parentEpicSummary;
        }

        let parentEpicKey: string | null = null;
        try {
            const parentEpicIssue = await createJiraIssue(jiraUrl, email, apiToken, parentEpicFields);
            parentEpicKey = parentEpicIssue.key;
        } catch (err: any) {
            console.warn('[Jira] Failed to create parent epic:', err.message);
        }

        const creationResults = [];

        if (structuredData.epics && Array.isArray(structuredData.epics)) {
            for (const epic of structuredData.epics) {
                const epicSummary = epic.summary || 'Epic';
                const epicDescription = epic.description || '';

                const epicFields: JiraIssueFields = {
                    project: { key: projectKey },
                    summary: epicSummary,
                    description: toADF(epicDescription),
                    issuetype: { name: EPIC_ISSUE_TYPE_NAME },
                    labels: [`upload-${uploadTimestamp}`],
                };

                if (EPIC_NAME_FIELD_ID && EPIC_NAME_FIELD_ID !== 'skip') {
                    epicFields[EPIC_NAME_FIELD_ID] = epicSummary;
                }

                const epicIssue = await createJiraIssue(jiraUrl, email, apiToken, epicFields);
                const epicKey = epicIssue.key;

                if (parentEpicKey) {
                    await linkJiraIssues(jiraUrl, email, apiToken, parentEpicKey, epicKey);
                }

                const storiesCreated = [];
                if (epic.stories && Array.isArray(epic.stories)) {
                    for (const story of epic.stories) {
                        const storyFields: JiraIssueFields = {
                            project: { key: projectKey },
                            summary: story.summary || 'Story',
                            description: toADF(story.description || ''),
                            issuetype: { name: STORY_ISSUE_TYPE_NAME },
                        };

                        if (EPIC_LINK_FIELD_ID && EPIC_LINK_FIELD_ID !== 'skip') {
                            storyFields[EPIC_LINK_FIELD_ID] = epicKey;
                        }

                        const storyIssue = await createJiraIssue(jiraUrl, email, apiToken, storyFields);
                        storiesCreated.push(storyIssue.key);
                    }
                }

                creationResults.push({
                    epicKey,
                    stories: storiesCreated
                });
            }
        }

        return NextResponse.json({
            message: 'Requirements analyzed and Jira issues created successfully!',
            stats: {
                epics: structuredData.epics ? structuredData.epics.length : 0,
                parentEpic: parentEpicKey,
                uploadLabel: `upload-${uploadTimestamp}`,
            },
            jira: {
                parentEpic: parentEpicKey,
                childEpics: creationResults,
            }
        });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { message: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
