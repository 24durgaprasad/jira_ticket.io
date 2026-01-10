import { useState, useRef, ChangeEvent } from 'react';
import { Upload, FileText, CheckCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface FileUploadProps {
    name: string;
    onChange?: (file: File | null) => void;
    accept?: string;
    required?: boolean;
}

export function FileUpload({ name, onChange, accept, required }: FileUploadProps) {
    const [file, setFile] = useState<File | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = (selectedFile: File) => {
        setFile(selectedFile);
        if (onChange) onChange(selectedFile);
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            // Need to manually set input files if dropping, for form submission
            if (inputRef.current) {
                inputRef.current.files = e.dataTransfer.files;
            }
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const clearFile = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault(); // Prevent opening file dialog
        setFile(null);
        if (inputRef.current) inputRef.current.value = '';
        if (onChange) onChange(null);
    }

    return (
        <div className="relative group w-full">
            <input
                ref={inputRef}
                type="file"
                name={name}
                id={name}
                accept={accept}
                onChange={handleChange}
                required={required}
                className="hidden"
            />

            <motion.div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                animate={{
                    borderColor: isDragOver ? "rgb(14 165 233)" : (file ? "rgb(14 165 233)" : "rgba(51, 65, 85, 0.5)"),
                    backgroundColor: isDragOver ? "rgba(14, 165, 233, 0.1)" : (file ? "rgba(14, 165, 233, 0.05)" : "rgba(30, 41, 59, 0.3)")
                }}
                className={cn(
                    "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-all cursor-pointer select-none",
                    "hover:border-sky-500/50 hover:bg-sky-500/5"
                )}
            >
                <AnimatePresence mode='wait'>
                    {file ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="flex items-center gap-4 w-full max-w-sm bg-slate-800/80 p-4 rounded-xl border border-slate-700"
                        >
                            <div className="p-2 bg-sky-500/10 rounded-lg text-sky-400">
                                <FileText size={24} />
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-medium text-slate-200 truncate">{file.name}</p>
                                <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                            </div>
                            <button
                                type="button"
                                onClick={clearFile}
                                className="p-1 hover:bg-slate-700 rounded-full text-slate-400 hover:text-red-400 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </motion.div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-center"
                        >
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/50 text-slate-400 transition-colors group-hover:text-sky-400">
                                <Upload size={32} />
                            </div>
                            <p className="mb-1 text-sm font-medium text-slate-300">
                                <span className="text-sky-400 hover:underline">Click to upload</span> or drag and drop
                            </p>
                            <p className="text-xs text-slate-500">Text files only (TXT, MD)</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
