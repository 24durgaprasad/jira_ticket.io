import { z } from 'zod';

// Zod Schema for API Input Validation
export const GenerateTicketsSchema = z.object({
    jiraUrl: z.string().url(),
    projectKey: z.string().min(2).max(10),
    email: z.string().email(),
    apiToken: z.string().min(1),
    // File validation is handled separately due to FormData limitations, 
    // but we can define the shape of what we expect after parsing
});

// Jira API Types
export interface JiraIssueFields {
    project: { key: string };
    summary: string;
    description: any; // ADF Object
    issuetype: { name: string };
    labels?: string[];
    [key: string]: any; // Allow custom fields
}

export interface JiraIssueResponse {
    id: string;
    key: string;
    self: string;
}

export interface Epic {
    summary: string;
    description?: string;
    stories?: Story[];
}

export interface Story {
    summary: string;
    description?: string;
}

export interface AIAnalysisResult {
    epics: Epic[];
}
