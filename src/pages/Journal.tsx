import { BookOpen } from 'lucide-react';

const Journal = () => {
  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-primary" /> Journal & Analytics
      </h1>
      <div className="bg-card border border-border rounded-lg p-6 max-w-3xl">
        <p className="text-sm text-muted-foreground">
          No live journal datasource is connected. Historical trade analytics are intentionally blank until a real trades API/database is configured.
        </p>
      </div>
    </div>
  );
};

export default Journal;
