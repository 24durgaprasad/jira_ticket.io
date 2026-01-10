'use client';

import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, ArrowRight, LayoutDashboard, Sparkles, Clock, Loader2 } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileUpload } from '@/components/ui/file-upload';
import { cn } from '@/lib/utils';

const PROCESSING_MESSAGES = [
    'Uploading your document...',
    'Analyzing requirements with AI...',
    'Extracting epics and stories...',
    'Structuring your tickets...',
    'Almost there, generating final output...',
];

export default function Home() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string; details?: any } | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [processingMessage, setProcessingMessage] = useState('');

    // Timer effect
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (loading) {
            setElapsedTime(0);
            interval = setInterval(() => {
                setElapsedTime(prev => prev + 1);
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [loading]);

    // Cycling processing messages
    useEffect(() => {
        if (loading) {
            const messageIndex = Math.min(
                Math.floor(elapsedTime / 20),
                PROCESSING_MESSAGES.length - 1
            );
            setProcessingMessage(PROCESSING_MESSAGES[messageIndex]);
        }
    }, [loading, elapsedTime]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setStatus(null);

        const formData = new FormData(e.currentTarget);

        try {
            const res = await fetch('/api/generate', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || data.error || 'Something went wrong');
            }

            setStatus({
                type: 'success',
                message: 'Tickets Created Successfully!',
                details: data,
            });
        } catch (err: any) {
            setStatus({
                type: 'error',
                message: err.message,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen w-full overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0f1c] to-slate-950 text-slate-200 selection:bg-sky-500/30">

            {/* Background Ambience */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-sky-500/10 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-500/10 blur-[120px]" />
            </div>

            <div className="relative z-10 mx-auto max-w-5xl px-6 py-20 lg:py-32">

                {/* Header */}
                <div className="mb-16 text-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-sky-400 mb-6"
                    >
                        <Sparkles size={14} />
                        <span>AI Powered Workflow</span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="mb-6 text-5xl font-bold tracking-tight text-white sm:text-7xl"
                    >
                        Jira <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-violet-500">Wizard</span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="mx-auto max-w-2xl text-lg text-slate-400/80 leading-relaxed"
                    >
                        Transform rough requirements documents or whiteboard screenshots into fully structured Jira Epics and Stories using advanced AI.
                    </motion.p>
                </div>

                <div className="grid gap-12 lg:grid-cols-[1fr,360px]">

                    {/* Main Form */}
                    <Card className="order-2 lg:order-1 border-white/5 bg-white/5 backdrop-blur-xl p-6 sm:p-8">
                        <form onSubmit={handleSubmit} className="space-y-8">
                            <div className="grid gap-6 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="jiraUrl" className="text-slate-200">Jira Domain</Label>
                                    <Input id="jiraUrl" name="jiraUrl" placeholder="company.atlassian.net" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="projectKey" className="text-slate-200">Project Key</Label>
                                    <Input id="projectKey" name="projectKey" placeholder="e.g. ENG" required />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-slate-200">Email Address</Label>
                                <Input type="email" id="email" name="email" placeholder="you@company.com" required />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="apiToken" className="text-slate-200">API Token</Label>
                                <Input type="password" id="apiToken" name="apiToken" placeholder="Atlassian API Token" required />
                            </div>

                            <div className="space-y-3 pt-2">
                                <Label className="text-slate-200">Requirements Document</Label>
                                <FileUpload name="requirementsFile" accept=".txt,.md" required />
                            </div>

                            <div className="pt-4">
                                <Button type="submit" isLoading={loading} className="w-full text-base py-6 bg-gradient-to-r from-sky-500 to-violet-600 hover:opacity-90 transition-opacity">
                                    Generate Tickets <ArrowRight className="ml-2 h-5 w-5" />
                                </Button>
                            </div>
                        </form>
                    </Card>

                    {/* Status / Info Column */}
                    <div className="order-1 flex flex-col gap-6 lg:order-2">
                        {/* Processing Status Card */}
                        <AnimatePresence>
                            {loading && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                >
                                    <Card className="border-sky-500/30 bg-sky-950/20 backdrop-blur-xl p-6">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="relative">
                                                <Loader2 className="h-8 w-8 text-sky-400 animate-spin" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-sky-400">Processing...</h3>
                                                <p className="text-sm text-slate-400">{processingMessage}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <Clock className="h-4 w-4" />
                                                <span>Elapsed Time</span>
                                            </div>
                                            <span className="font-mono text-lg text-sky-400">{formatTime(elapsedTime)}</span>
                                        </div>
                                        <div className="mt-4 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                                            <motion.div
                                                className="h-full bg-gradient-to-r from-sky-500 to-violet-500"
                                                initial={{ width: '0%' }}
                                                animate={{ width: '100%' }}
                                                transition={{ duration: 120, ease: 'linear' }}
                                            />
                                        </div>
                                        <p className="text-xs text-slate-500 mt-2 text-center">AI analysis may take 1-2 minutes</p>
                                    </Card>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Live Status Card - Only shows when there is activity */}
                        <AnimatePresence mode="wait">
                            {status && (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                >
                                    <Card className={cn(
                                        "border-l-4 p-6",
                                        status.type === 'error' ? "border-l-red-500 bg-red-950/10 border-white/5" : "border-l-emerald-500 bg-emerald-950/10 border-white/5"
                                    )}>
                                        <div className="flex items-start gap-3">
                                            <div className="mt-1">
                                                {status.type === 'error' ? <AlertCircle className="text-red-400" /> : <CheckCircle className="text-emerald-400" />}
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                <h3 className={cn("font-semibold mb-1", status.type === 'error' ? 'text-red-400' : 'text-emerald-400')}>
                                                    {status.type === 'error' ? 'Generation Failed' : status.message}
                                                </h3>

                                                {status.type === 'error' ? (
                                                    <p className="text-sm text-red-200/70">{status.message}</p>
                                                ) : (
                                                    <div className="text-sm text-slate-300 space-y-3 mt-2">
                                                        {status.details?.stats && (
                                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                                <div className="bg-slate-800/50 p-2 rounded">
                                                                    <div className="text-slate-500">Epics</div>
                                                                    <div className="text-lg font-bold text-sky-400">{status.details.stats.epics}</div>
                                                                </div>
                                                                <div className="bg-slate-800/50 p-2 rounded">
                                                                    <div className="text-slate-500">Parent</div>
                                                                    <div className="truncate font-mono text-emerald-400">{status.details.stats.parentEpic || '-'}</div>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {status.details?.jira?.childEpics?.length > 0 && (
                                                            <div className="mt-2">
                                                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Created Tickets</div>
                                                                <div className="max-h-[200px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                                                    {status.details.jira.childEpics.map((epic: any, i: number) => (
                                                                        <div key={i} className="flex items-center justify-between text-xs bg-slate-800/30 p-2 rounded border border-white/5">
                                                                            <span className="font-mono text-sky-300">{epic.epicKey}</span>
                                                                            <span className="text-slate-500">{epic.stories.length} stories</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Helpful Tips (Static) */}
                        {!status && (
                            <Card className="bg-gradient-to-br from-slate-900/50 to-slate-900/10 border-white/5 backdrop-blur-md p-6">
                                <div className="flex items-center gap-2 mb-4 text-sky-400">
                                    <LayoutDashboard size={20} />
                                    <h3 className="font-semibold">How it works</h3>
                                </div>
                                <ul className="space-y-4 text-sm text-slate-400">
                                    <li className="flex gap-3 items-start">
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-slate-200">1</span>
                                        <div className="pt-0.5">Upload a text file or screenshot containing your requirements.</div>
                                    </li>
                                    <li className="flex gap-3 items-start">
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-slate-200">2</span>
                                        <div className="pt-0.5">AI analyzes the content and structures it into Epics and Stories.</div>
                                    </li>
                                    <li className="flex gap-3 items-start">
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-slate-200">3</span>
                                        <div className="pt-0.5">Tickets are automatically created in your Jira project.</div>
                                    </li>
                                </ul>
                            </Card>
                        )}
                    </div>

                </div>
            </div>
        </main>
    );
}
