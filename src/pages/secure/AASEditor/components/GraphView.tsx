import { useTranslation } from 'react-i18next';
import { SubmodelTemplate } from '@/context/AASContext';

interface GraphViewProps {
  aasId: string;
  sms: SubmodelTemplate[];
}

export default function GraphView({ aasId, sms }: GraphViewProps) {
  const { t } = useTranslation();
  const W = 900;
  const maxEl = sms.reduce((a, s) => Math.max(a, (s.elements || []).length), 0);
  const H = Math.max(500, 120 + sms.length * 60 + maxEl * 38);
  const cx = W / 2, cy = 50;
  const n = sms.length;
  const sp = Math.min(210, (W - 120) / (n || 1));
  const sx0 = cx - (n - 1) * sp / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%', minHeight: 460 }}>
      <defs>
        <marker id="ar" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto">
          <polygon points="0 0,10 3.5,0 7" fill="#6366f1" opacity=".5" />
        </marker>
      </defs>
      <rect x={cx - 90} y={cy - 22} width={180} height={44} rx={10} fill="#1a2040" stroke="#6366f1" strokeWidth="2" />
      <text x={cx} y={cy - 4} textAnchor="middle" fill="#6366f1" fontSize="9" fontFamily="monospace" fontWeight="600">AAS</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#e8ecf2" fontSize="11" fontFamily="sans-serif" fontWeight="600">
        {aasId.replace('AAS_', '')}
      </text>

      {sms.map((sm, idx) => {
        const x = sx0 + idx * sp, y = 160;
        const ey0 = y + 55;
        const elements = sm.elements || [];

        return (
          <g key={sm.id}>
            <line x1={cx} y1={cy + 22} x2={x} y2={y - 20} stroke="#6366f1" strokeWidth="1.5" opacity=".3" markerEnd="url(#ar)" />
            <rect x={x - 75} y={y - 20} width={150} height={40} rx={8} fill="#10291a" stroke="#10b981" strokeWidth="1.5" />
            <text x={x} y={y - 3} textAnchor="middle" fill="#10b981" fontSize="8" fontFamily="monospace" fontWeight="600">SUBMODEL</text>
            <text x={x} y={y + 10} textAnchor="middle" fill="#e8ecf2" fontSize="10" fontFamily="sans-serif" fontWeight="600">{sm.idShort}</text>
            
            {elements.slice(0, 9).map((el, ei) => {
              const ey = ey0 + ei * 36;
              const isCollection = el.type === 'SubmodelElementCollection';
              const isOperation = el.type === 'Operation';
              
              const c = isCollection ? '#f5a623' : isOperation ? '#50a0ff' : '#a0aec0';
              const bg = isCollection ? '#291f10' : isOperation ? '#0f1a2a' : '#151a22';
              const abbr = el.type === 'Property' ? 'P' : isCollection ? 'C' : el.type === 'MultiLanguageProperty' ? 'MLP' : el.type === 'File' ? 'F' : '?';
              
              return (
                <g key={ei}>
                  <line x1={x} y1={y + 20} x2={x} y2={ey - 10} stroke={c} strokeWidth="1" opacity=".15" strokeDasharray={ei ? '3,3' : ''} />
                  <rect x={x - 65} y={ey - 12} width={130} height={24} rx={6} fill={bg} stroke={c} strokeWidth="1" opacity=".8" />
                  <text x={x - 53} y={ey + 2} fill={c} fontSize="7" fontFamily="monospace" opacity=".7">{abbr}</text>
                  <text x={x - 40} y={ey + 2} fill="#e8ecf2" fontSize="9" fontFamily="sans-serif">
                    {el.idShort.length > 13 ? el.idShort.slice(0, 13) + '…' : el.idShort}
                  </text>
                  {el.required && <circle cx={x + 58} cy={ey} r={3} fill="#f05252" />}
                </g>
              );
            })}
          </g>
        );
      })}

      {!sms.length && (
        <text x={cx} y={cy + 80} textAnchor="middle" fill="#3d4a5c" fontSize="12" fontFamily="sans-serif">
          {t('editor.graphNoSubmodels')}
        </text>
      )}
    </svg>
  );
}
