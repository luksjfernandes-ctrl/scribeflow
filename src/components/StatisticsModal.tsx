import React, { useMemo } from 'react';
import { X, BarChart3 } from 'lucide-react';
import { Doc } from '../types';

interface StatisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  docs: Doc[];
}

const LABEL_NAMES: Record<string, string> = {
  none: 'No Label',
  red: 'Chapter',
  green: 'Scene',
  blue: 'Research',
  yellow: 'Note',
  orange: 'Note',
  purple: 'Idea',
};

const STOP_WORDS = new Set(
  'the a an and or but of to in on at for with as is are was were be been being it its this that these those i you he she they we him her them his hers their our your my me do does did so if then than too very can will just not no yes from by up out about into over after under above below more most some such only own same again once here there all any each few other into'.split(
    ' '
  )
);

const stripHtml = (html: string) =>
  (html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const StatRow =({ label, value, total, color }: { label: string; value: number; total: number; color: string }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-300">
        <span>{label}</span>
        <span className="font-mono text-gray-400">
          {value.toLocaleString()} <span className="text-gray-500">({pct}%)</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};

export function StatisticsModal({ isOpen, onClose, docs }: StatisticsModalProps) {
  const stats = useMemo(() => {
    const textDocs = docs.filter((d) => d.type === 'text' && d.metadata?.folder_role !== 'trash');
    let totalWords = 0;
    let totalChars = 0;
    const byStatus: Record<string, number> = {};
    const byLabel: Record<string, number> = {};
    const freq: Record<string, number> = {};

    for (const d of textDocs) {
      const text = stripHtml(d.content);
      const words = text ? text.split(' ').filter(Boolean) : [];
      totalWords += words.length;
      totalChars += text.replace(/\s/g, '').length;

      const status = d.metadata?.status || 'No Status';
      byStatus[status] = (byStatus[status] || 0) + words.length;

      const label = LABEL_NAMES[d.metadata?.label || 'none'] || 'No Label';
      byLabel[label] = (byLabel[label] || 0) + words.length;

      for (const raw of words) {
        const w = raw.toLowerCase().replace(/[^a-zà-ÿ']/gi, '');
        if (w.length < 3 || STOP_WORDS.has(w)) continue;
        freq[w] = (freq[w] || 0) + 1;
      }
    }

    const folders = docs.filter((d) => d.type !== 'text' && d.metadata?.folder_role !== 'trash').length;
    const topWords = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);

    return {
      totalWords,
      totalChars,
      docCount: textDocs.length,
      folders,
      byStatus: Object.entries(byStatus).sort((a, b) => b[1] - a[1]),
      byLabel: Object.entries(byLabel).sort((a, b) => b[1] - a[1]),
      topWords,
      avgPerDoc: textDocs.length ? Math.round(totalWords / textDocs.length) : 0,
      readingMins: Math.max(1, Math.round(totalWords / 200)),
    };
  }, [docs]);

  if (!isOpen) return null;

  const STATUS_COLORS = ['#8A6D3B', '#5B7A3D', '#4070D0', '#40A040'];
  const LABEL_COLORS = ['#E05050', '#40A040', '#4070D0', '#D0B020', '#8040D0'];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" onClick={onClose}>
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[85vh] overflow-y-auto scrivener-scrollbar bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl z-[101]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between p-4 border-b border-[#333] bg-[#222]">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-100">
            <BarChart3 size={18} className="text-[#5B7A3D]" /> Project Statistics
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-[#333] rounded-md transition-colors text-gray-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Overview */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { k: 'Words', v: stats.totalWords.toLocaleString() },
              { k: 'Characters', v: stats.totalChars.toLocaleString() },
              { k: 'Documents', v: stats.docCount.toLocaleString() },
              { k: 'Folders', v: stats.folders.toLocaleString() },
              { k: 'Avg / Document', v: `${stats.avgPerDoc.toLocaleString()} words` },
              { k: 'Reading Time', v: `~${stats.readingMins} min` },
            ].map((s) => (
              <div key={s.k} className="rounded-lg bg-[#222] border border-[#2e2e2e] px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-widest text-gray-500">{s.k}</div>
                <div className="text-xl font-bold text-gray-100">{s.v}</div>
              </div>
            ))}
          </div>

          {/* By status */}
          {stats.byStatus.length > 0 && (
            <div className="space-y-2.5">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">Words by Status</div>
              {stats.byStatus.map(([name, val], i) => (
                <StatRow key={name} label={name} value={val} total={stats.totalWords} color={STATUS_COLORS[i % STATUS_COLORS.length]} />
              ))}
            </div>
          )}

          {/* By label */}
          {stats.byLabel.length > 0 && (
            <div className="space-y-2.5">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">Words by Label</div>
              {stats.byLabel.map(([name, val], i) => (
                <StatRow key={name} label={name} value={val} total={stats.totalWords} color={LABEL_COLORS[i % LABEL_COLORS.length]} />
              ))}
            </div>
          )}

          {/* Word frequency */}
          {stats.topWords.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">Most Frequent Words</div>
              <div className="flex flex-wrap gap-1.5">
                {stats.topWords.map(([word, n]) => (
                  <span
                    key={word}
                    className="rounded-full border border-[#3a3a3a] bg-[#222] px-2.5 py-0.5 text-xs text-gray-300"
                  >
                    {word} <span className="text-gray-500">·{n}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {stats.docCount === 0 && (
            <p className="text-center text-sm italic text-gray-500 py-6">No text documents yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
