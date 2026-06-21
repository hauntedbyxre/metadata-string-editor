import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';

interface Props {
  onUpload: (file: File) => void;
  loading: boolean;
}

export default function UploadZone({ onUpload, loading }: Props) {
  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) onUpload(accepted[0]);
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/octet-stream': ['.dat'] },
    maxFiles: 1,
    disabled: loading,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
        isDragActive
          ? 'border-[var(--accent)] bg-[var(--accent)]/5'
          : 'border-[var(--border)] hover:border-[var(--accent)]'
      } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
    >
      <input {...getInputProps()} />
      <Upload className="mx-auto mb-4 text-[var(--text-muted)]" size={40} />
      {loading ? (
        <p className="text-[var(--text-muted)]">Parsing metadata...</p>
      ) : isDragActive ? (
        <p className="text-[var(--accent)] font-medium">Drop file here</p>
      ) : (
        <>
          <p className="text-[var(--text-primary)] font-medium">
            Drop your <code className="text-[var(--accent)]">global-metadata.dat</code> here
          </p>
          <p className="text-[var(--text-muted)] text-sm mt-1">or click to browse</p>
        </>
      )}
      <p className="text-[var(--text-muted)] text-xs mt-6 text-center">Made by XRE</p>
    </div>
  );
}
