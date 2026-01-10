const EPIC_NAME_FIELD_ID = process.env.JIRA_EPIC_NAME_FIELD_ID || "customfield_10011";
const EPIC_LINK_FIELD_ID = process.env.JIRA_EPIC_LINK_FIELD_ID || "customfield_10014";
const EPIC_ISSUE_TYPE_NAME = process.env.JIRA_EPIC_ISSUETYPE_NAME || "Epic";
const STORY_ISSUE_TYPE_NAME = process.env.JIRA_STORY_ISSUETYPE_NAME || "Story";

function toADF(text: string) {
    return {
        type: "doc",
        version: 1,
        content: [
            {
                type: "paragraph",
                content: [{ type: "text", text: text || "" }],
            },
        ],
    };
}

function buildJiraAuthHeader(email: string, apiToken: string) {
    const token = Buffer.from(`${email}:${apiToken}`).toString("base64");
    return `Basic ${token}`;
}

import { JiraIssueFields } from './types';

function getJiraErrorMessage(status: number, errorText: string): string {
    // Parse the error text to check for common patterns
    const lowerError = errorText.toLowerCase();

    if (status === 401) {
        return 'Invalid Jira credentials. Please check your email and API token.';
    }
    if (status === 403) {
        return 'Access denied. Your API token may not have permission to create issues in this project.';
    }
    if (status === 404) {
        if (lowerError.includes('site temporarily unavailable') || lowerError.includes('site not found')) {
            return 'Jira site not found. Please verify your Jira URL (e.g., yourcompany.atlassian.net).';
        }
        if (lowerError.includes('project')) {
            return 'Project not found. Please verify your Project Key is correct.';
        }
        return 'Jira resource not found. Please check your Jira URL and Project Key.';
    }
    if (status === 400) {
        if (lowerError.includes('issuetype')) {
            return 'Invalid issue type. Your Jira project may use different issue type names.';
        }
        return 'Invalid request to Jira. Please check your project settings.';
    }
    if (status >= 500) {
        return 'Jira server error. The Jira service may be temporarily unavailable. Please try again later.';
    }

    return `Jira API error (${status}). Please verify your credentials and try again.`;
}

export async function createJiraIssue(
    jiraUrl: string,
    email: string,
    apiToken: string,
    fields: JiraIssueFields
) {
    const normalizedJiraUrl = jiraUrl.startsWith('http') ? jiraUrl : `https://${jiraUrl}`;
    const endpoint = new URL('/rest/api/3/issue', normalizedJiraUrl).toString();
    const authHeader = buildJiraAuthHeader(email, apiToken);

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: authHeader,
        },
        body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Jira] Request failed: ${response.status} ${errorText}`);
        const userMessage = getJiraErrorMessage(response.status, errorText);
        throw new Error(userMessage);
    }

    return response.json();
}

export async function linkJiraIssues(
    jiraUrl: string,
    email: string,
    apiToken: string,
    inwardIssue: string,
    outwardIssue: string,
    linkType = 'Relates'
) {
    const normalizedJiraUrl = jiraUrl.startsWith('http') ? jiraUrl : `https://${jiraUrl}`;
    const endpoint = new URL('/rest/api/3/issueLink', normalizedJiraUrl).toString();
    const authHeader = buildJiraAuthHeader(email, apiToken);

    const body = {
        type: { name: linkType },
        inwardIssue: { key: inwardIssue },
        outwardIssue: { key: outwardIssue }
    };

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: authHeader,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        console.warn(`[Jira] Failed to link issues ${inwardIssue} <-> ${outwardIssue}`);
        return false;
    }
    return true;
}

export { EPIC_NAME_FIELD_ID, EPIC_LINK_FIELD_ID, EPIC_ISSUE_TYPE_NAME, STORY_ISSUE_TYPE_NAME, toADF };
