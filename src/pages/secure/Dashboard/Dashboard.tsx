import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, CardActionArea, Chip, Stack, Typography, Divider,
  Paper, Avatar, Tooltip, LinearProgress,
} from '@mui/material';
import {
  AccountTreeRounded, LayersRounded, MemoryRounded, CheckCircleOutlineRounded,
  EditNoteRounded, AddCircleOutlineRounded, RemoveCircleOutlineRounded,
  SyncAltRounded, ArrowForwardIosRounded, HubRounded, InfoOutlined,
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';

import { useAASContext, type ChangeType, type ChangeDetail } from '@/context/AASContext';
import { useSessionContext } from '@/context/SessionContext';
import { brand, violet, green, orange, red } from '@/theme/themePrimitives';

// ─── helpers ────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buongiorno';
  if (h < 18) return 'Buon pomeriggio';
  return 'Buona sera';
}

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'Oggi';
  if (d === 1) return 'Ieri';
  if (d < 7) return `${d}g fa`;
  if (d < 30) return `${Math.floor(d / 7)}w fa`;
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_COLOR = {
  Active: 'success',
  Draft: 'warning',
  Deprecated: 'default',
} as const;

const STATUS_LABEL: Record<string, string> = {
  Active: 'Versione approvata e in uso operativo',
  Draft: 'In lavorazione — non ancora rilasciata',
  Deprecated: 'Sorpassata da una versione più recente',
};

const CHANGE_META: Record<ChangeType, { icon: typeof AddCircleOutlineRounded; color: string; label: string }> = {
  added:    { icon: AddCircleOutlineRounded,    color: green[400],  label: 'Aggiunto' },
  modified: { icon: SyncAltRounded,             color: orange[400], label: 'Modificato' },
  removed:  { icon: RemoveCircleOutlineRounded, color: red[400],    label: 'Rimosso' },
};

// ─── KPI Card ───────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number;
  total?: number;
  icon: React.ReactNode;
  accentColor: string;
  sub?: string;
}

function KpiCard({ label, value, total, icon, accentColor, sub }: KpiCardProps) {
  const pct = total ? Math.round((value / total) * 100) : null;
  return (
    <Card sx={{ flex: '1 1 160px' }}>
      <CardContent sx={{ p: '20px !important' }}>
        <Box
          sx={{
            width: 40, height: 40, borderRadius: 2, mb: 2, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: `linear-gradient(135deg, ${alpha(accentColor, 0.18)}, ${alpha(accentColor, 0.08)})`,
            color: accentColor,
          }}
        >
          {icon}
        </Box>
        <Typography variant="h3" fontWeight={800} color="text.primary" lineHeight={1} sx={{ fontSize: '2rem' }}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mt={0.5}
          textTransform="uppercase" letterSpacing={0.5}>
          {label}
        </Typography>
        {sub && (
          <Typography variant="caption" color="text.disabled" display="block" mt={0.25}>
            {sub}
          </Typography>
        )}
        {pct !== null && (
          <Box mt={1.5}>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{
                height: 4, borderRadius: 2,
                bgcolor: alpha(accentColor, 0.12),
                '& .MuiLinearProgress-bar': {
                  borderRadius: 2,
                  background: `linear-gradient(90deg, ${accentColor}, ${alpha(accentColor, 0.6)})`,
                },
              }}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// ─── AAS Card ───────────────────────────────────────────────────────────────

interface AasCardProps {
  model: ReturnType<typeof useAASContext>['availableModels'][number];
  onClick: () => void;
}

function AasCard({ model, onClick }: AasCardProps) {
  const latestVersion = model.versions[0];
  const status = latestVersion?.status ?? 'Draft';
  const isType = model.assetKind === 'Type';
  const displayName = model.idShort.replace(/^AAS_/, '');

  return (
    <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 0 }}>
      <CardActionArea onClick={onClick} sx={{ flex: 1, borderRadius: 'inherit', p: 0 }}>
        <CardContent sx={{ p: '20px !important', display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%' }}>

          {/* Header */}
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
            <Box
              sx={{
                width: 38, height: 38, borderRadius: 2, flexShrink: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: isType
                  ? `linear-gradient(135deg, ${alpha(violet[400], 0.18)}, ${alpha(violet[400], 0.08)})`
                  : `linear-gradient(135deg, ${alpha(brand[400], 0.18)}, ${alpha(brand[400], 0.08)})`,
                color: isType ? violet[500] : brand[500],
              }}
            >
              {isType ? <MemoryRounded sx={{ fontSize: 18 }} /> : <HubRounded sx={{ fontSize: 18 }} />}
            </Box>
            <Tooltip title={STATUS_LABEL[status] ?? ''} arrow placement="top">
              <Chip
                size="small"
                label={status}
                color={STATUS_COLOR[status]}
                variant="outlined"
                icon={<InfoOutlined sx={{ fontSize: '12px !important' }} />}
                sx={{ fontSize: 10, height: 22, fontWeight: 700, cursor: 'help' }}
              />
            </Tooltip>
          </Stack>

          {/* Name & description */}
          <Box>
            <Typography variant="subtitle2" fontWeight={700} noWrap title={displayName}>
              {displayName}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" noWrap
              title={model.description} mt={0.25}>
              {model.description}
            </Typography>
          </Box>

          {/* Stats */}
          <Stack direction="row" spacing={1.5} mt="auto">
            <Tooltip title="Submodels">
              <Stack direction="row" alignItems="center" spacing={0.4}>
                <LayersRounded sx={{ fontSize: 12, color: 'text.disabled' }} />
                <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                  {model.submodels.length} SM
                </Typography>
              </Stack>
            </Tooltip>
            <Tooltip title="Ultima versione">
              <Stack direction="row" alignItems="center" spacing={0.4}>
                <AccountTreeRounded sx={{ fontSize: 12, color: 'text.disabled' }} />
                <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                  v{latestVersion?.version ?? '—'}
                </Typography>
              </Stack>
            </Tooltip>
          </Stack>

          <Stack direction="row" alignItems="center" justifyContent="space-between" mt={0.5}>
            <Typography variant="caption" color="text.disabled" fontFamily="monospace">
              {latestVersion ? relativeDate(latestVersion.date) : '—'}
            </Typography>
            <ArrowForwardIosRounded sx={{ fontSize: 11, color: 'text.disabled' }} />
          </Stack>

        </CardContent>
      </CardActionArea>
    </Card>
  );
}

// ─── Activity Feed ───────────────────────────────────────────────────────────

interface ActivityItem {
  aasId: string;
  aasName: string;
  date: string;
  author: string;
  version: string;
  change: ChangeDetail;
}

function groupByDay(items: ActivityItem[]) {
  const groups: { label: string; items: ActivityItem[] }[] = [];
  const seen = new Map<string, number>();

  items.forEach(item => {
    const d = Math.floor((Date.now() - new Date(item.date).getTime()) / 86400000);
    const label = d === 0 ? 'Oggi' : d === 1 ? 'Ieri' : d < 7 ? `${d} giorni fa` : relativeDate(item.date);
    const dayKey = new Date(item.date).toDateString();

    if (!seen.has(dayKey)) {
      seen.set(dayKey, groups.length);
      groups.push({ label, items: [item] });
    } else {
      groups[seen.get(dayKey)!].items.push(item);
    }
  });

  return groups;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { availableModels, setSelectedModelId } = useAASContext();
  const { operator } = useSessionContext();
  const navigate = useNavigate();

  const totalAAS      = availableModels.length;
  const activeCount   = availableModels.filter(m => m.versions[0]?.status === 'Active').length;
  const draftCount    = availableModels.filter(m => m.versions[0]?.status === 'Draft').length;
  const totalSubmodels = availableModels.reduce((s, m) => s + m.submodels.length, 0);

  const sortedModels = useMemo(() =>
    [...availableModels].sort((a, b) =>
      (b.versions[0]?.date ?? '').localeCompare(a.versions[0]?.date ?? '')
    ),
  [availableModels]);

  const recentActivity = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];
    availableModels.forEach(m => {
      m.versions.forEach(v => {
        (v.details || []).forEach(d => {
          items.push({
            aasId: m.id,
            aasName: m.idShort.replace(/^AAS_/, ''),
            date: v.date,
            author: v.author,
            version: v.version,
            change: d,
          });
        });
      });
    });
    return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
  }, [availableModels]);

  const handleOpenAAS = (id: string) => {
    setSelectedModelId(id);
    navigate('/editor');
  };

  const todayStr = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <Box sx={{ pb: 4 }}>

      {/* ── Welcome ──────────────────────────────────────────────── */}
      <Box
        sx={{
          mb: 3, px: 1, py: 2, borderRadius: 3,
          background: `linear-gradient(135deg, ${alpha(brand[400], 0.07)} 0%, ${alpha(violet[400], 0.04)} 100%)`,
        }}
      >
        <Typography variant="h5" fontWeight={800} color="text.primary">
          {greeting()}{operator.name ? `, ${operator.name}` : ''} 👋
        </Typography>
        <Typography variant="body2" color="text.secondary" mt={0.25} sx={{ textTransform: 'capitalize' }}>
          {todayStr}
        </Typography>
      </Box>

      {/* ── KPI row ──────────────────────────────────────────────── */}
      <Stack direction="row" spacing={2} mb={3} flexWrap="wrap" useFlexGap>
        <KpiCard
          label="Asset Administration Shells"
          value={totalAAS}
          icon={<AccountTreeRounded sx={{ fontSize: 20 }} />}
          accentColor={brand[400]}
          sub={`${availableModels.filter(m => m.assetKind === 'Instance').length} Instance · ${availableModels.filter(m => m.assetKind === 'Type').length} Type`}
        />
        <KpiCard
          label="Versioni attive"
          value={activeCount}
          total={totalAAS}
          icon={<CheckCircleOutlineRounded sx={{ fontSize: 20 }} />}
          accentColor={green[400]}
          sub={`${Math.round((activeCount / (totalAAS || 1)) * 100)}% del totale`}
        />
        <KpiCard
          label="Submodels totali"
          value={totalSubmodels}
          icon={<LayersRounded sx={{ fontSize: 20 }} />}
          accentColor={violet[400]}
          sub={`${totalAAS ? (totalSubmodels / totalAAS).toFixed(1) : 0} media per AAS`}
        />
        <KpiCard
          label="Bozze in corso"
          value={draftCount}
          total={totalAAS}
          icon={<EditNoteRounded sx={{ fontSize: 20 }} />}
          accentColor={orange[400]}
          sub={draftCount > 0 ? 'Da revisionare' : 'Tutto in ordine'}
        />
      </Stack>

      {/* ── Riga centrale: AAS grid + Riepilogo AAS ─────────────── */}
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="flex-start" mb={3}>

        {/* AAS Grid */}
        <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
            <Typography variant="overline" color="text.disabled" letterSpacing={1}>
              I tuoi AAS — {totalAAS} totali
            </Typography>
            <Stack direction="row" spacing={0.75} ml="auto">
              {(['Active', 'Draft', 'Deprecated'] as const).map(s => (
                <Tooltip key={s} title={STATUS_LABEL[s]} arrow>
                  <Chip
                    size="small" label={s} color={STATUS_COLOR[s]} variant="outlined"
                    sx={{ fontSize: 9, height: 18, fontWeight: 700, cursor: 'help' }}
                  />
                </Tooltip>
              ))}
            </Stack>
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' },
              gap: 2,
            }}
          >
            {sortedModels.map(m => (
              <AasCard key={m.id} model={m} onClick={() => handleOpenAAS(m.id)} />
            ))}
          </Box>
        </Box>

        {/* Riepilogo AAS (colonna destra) */}
        <Box sx={{ width: { xs: '100%', lg: 340 }, flexShrink: 0 }}>
          <Typography variant="overline" color="text.disabled" display="block" mb={1.5} letterSpacing={1}>
            Riepilogo AAS
          </Typography>
          <Paper
            variant="outlined"
            sx={{ borderRadius: 3, overflow: 'hidden', border: '1.5px solid', borderColor: alpha(brand[300], 0.2) }}
          >
            {sortedModels.map((m, idx) => {
              const v = m.versions[0];
              const status = v?.status ?? 'Draft';
              return (
                <Box key={m.id}>
                  {idx > 0 && <Divider />}
                  <Tooltip title={STATUS_LABEL[status]} arrow placement="left">
                    <Stack
                      direction="row" alignItems="center" spacing={1.5}
                      sx={{
                        px: 2, py: 1.5, cursor: 'pointer',
                        transition: 'background 150ms',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                      onClick={() => handleOpenAAS(m.id)}
                    >
                      <Avatar
                        sx={{
                          width: 32, height: 32, fontSize: 12, fontWeight: 700,
                          background: m.assetKind === 'Type'
                            ? `linear-gradient(135deg, ${violet[400]}, ${violet[600]})`
                            : `linear-gradient(135deg, ${brand[400]}, ${violet[500]})`,
                        }}
                      >
                        {m.idShort.replace(/^AAS_/, '').charAt(0)}
                      </Avatar>
                      <Box flex={1} minWidth={0}>
                        <Typography variant="caption" fontWeight={700} noWrap display="block">
                          {m.idShort.replace(/^AAS_/, '')}
                        </Typography>
                        <Typography variant="caption" color="text.disabled" fontFamily="monospace" sx={{ fontSize: 9 }}>
                          v{v?.version} · {m.submodels.length} SM · {v ? fmtDate(v.date) : '—'}
                        </Typography>
                      </Box>
                      <Chip
                        size="small" label={status} color={STATUS_COLOR[status]} variant="outlined"
                        sx={{ fontSize: 9, height: 18, fontWeight: 700 }}
                      />
                    </Stack>
                  </Tooltip>
                </Box>
              );
            })}
          </Paper>
        </Box>
      </Stack>

      {/* ── Attività recente — piena larghezza ───────────────────── */}
      <Box>
        <Stack direction="row" alignItems="center" spacing={2} mb={1.5}>
          <Typography variant="overline" color="text.disabled" letterSpacing={1}>
            Attività recente
          </Typography>
          {/* contatori per tipo */}
          <Stack direction="row" spacing={0.75}>
            {(['added', 'modified', 'removed'] as ChangeType[]).map(t => {
              const n = recentActivity.filter(i => i.change.type === t).length;
              if (!n) return null;
              const meta = CHANGE_META[t];
              return (
                <Tooltip key={t} title={meta.label} arrow>
                  <Box
                    sx={{
                      px: 0.75, py: 0.2, borderRadius: 1,
                      bgcolor: alpha(meta.color, 0.12),
                      border: `1px solid ${alpha(meta.color, 0.3)}`,
                      display: 'flex', alignItems: 'center', gap: 0.4,
                    }}
                  >
                    <meta.icon sx={{ fontSize: 11, color: meta.color }} />
                    <Typography sx={{ fontSize: 10, fontWeight: 700, color: meta.color, lineHeight: 1 }}>
                      {n}
                    </Typography>
                  </Box>
                </Tooltip>
              );
            })}
          </Stack>
          <Typography variant="caption" color="text.disabled" sx={{ ml: 'auto' }}>
            {recentActivity.length} modifiche totali
          </Typography>
        </Stack>

        <Paper
          variant="outlined"
          sx={{
            borderRadius: 3, overflow: 'hidden',
            border: '1.5px solid', borderColor: alpha(brand[300], 0.2),
          }}
        >
          {/* header */}
          <Box
            sx={{
              px: 2.5, py: 1.5,
              background: `linear-gradient(135deg, ${alpha(brand[400], 0.06)}, ${alpha(violet[400], 0.04)})`,
              borderBottom: '1px solid', borderColor: 'divider',
            }}
          >
            <Typography variant="caption" fontWeight={700} color="text.primary">
              Storico modifiche per tutti gli AAS
            </Typography>
          </Box>

          {/* body: griglia multi-colonna raggruppata per giorno */}
          <Box sx={{ p: 2.5 }}>
            {recentActivity.length === 0 ? (
              <Typography variant="body2" color="text.disabled" textAlign="center" py={4}>
                Nessuna attività registrata
              </Typography>
            ) : (
              (() => {
                const groups = groupByDay(recentActivity);
                return groups.map((group, gi) => (
                  <Box key={gi} mb={gi < groups.length - 1 ? 3 : 0}>
                    {/* day separator */}
                    <Stack direction="row" alignItems="center" spacing={1.5} mb={1.5}>
                      <Typography
                        variant="caption" fontWeight={700} color="text.disabled"
                        sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, whiteSpace: 'nowrap' }}
                      >
                        {group.label}
                      </Typography>
                      <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
                      <Typography variant="caption" color="text.disabled" sx={{ fontSize: 9, whiteSpace: 'nowrap' }}>
                        {group.items.length} {group.items.length === 1 ? 'modifica' : 'modifiche'}
                      </Typography>
                    </Stack>

                    {/* items grid */}
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                          xs: '1fr',
                          sm: 'repeat(2, 1fr)',
                          md: 'repeat(3, 1fr)',
                          xl: 'repeat(4, 1fr)',
                        },
                        gap: 1,
                      }}
                    >
                      {group.items.map((item, ii) => {
                        const meta = CHANGE_META[item.change.type];
                        const Icon = meta.icon;
                        return (
                          <Box
                            key={ii}
                            sx={{
                              display: 'flex', gap: 1.25, p: 1.25, borderRadius: 2,
                              border: '1px solid', borderColor: alpha(meta.color, 0.15),
                              bgcolor: alpha(meta.color, 0.04),
                              transition: 'background 150ms, border-color 150ms',
                              '&:hover': {
                                bgcolor: alpha(meta.color, 0.08),
                                borderColor: alpha(meta.color, 0.3),
                              },
                            }}
                          >
                            <Box
                              sx={{
                                width: 28, height: 28, borderRadius: 1.5, flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                bgcolor: alpha(meta.color, 0.14), color: meta.color, mt: 0.1,
                              }}
                            >
                              <Icon sx={{ fontSize: 14 }} />
                            </Box>
                            <Box flex={1} minWidth={0}>
                              <Stack direction="row" alignItems="center" spacing={0.6} flexWrap="wrap">
                                <Typography
                                  variant="caption" fontWeight={700} fontFamily="monospace"
                                  color="text.primary" sx={{ fontSize: 11 }} noWrap
                                >
                                  {item.change.name}
                                </Typography>
                                <Box
                                  sx={{
                                    px: 0.6, borderRadius: 0.75,
                                    bgcolor: alpha(meta.color, 0.1),
                                    border: `1px solid ${alpha(meta.color, 0.25)}`,
                                  }}
                                >
                                  <Typography sx={{ fontSize: 8.5, fontWeight: 700, color: meta.color, fontFamily: 'monospace', lineHeight: 1.7 }}>
                                    {item.change.target}
                                  </Typography>
                                </Box>
                              </Stack>
                              <Typography
                                variant="caption" color="text.secondary"
                                display="block" sx={{ lineHeight: 1.35, fontSize: 10.5 }} noWrap
                                title={item.change.desc}
                              >
                                {item.change.desc}
                              </Typography>
                              <Stack direction="row" alignItems="center" spacing={0.5} mt={0.4}>
                                <Avatar
                                  sx={{
                                    width: 13, height: 13, fontSize: 7, fontWeight: 700,
                                    background: `linear-gradient(135deg, ${brand[400]}, ${violet[500]})`,
                                  }}
                                >
                                  {item.aasName.charAt(0)}
                                </Avatar>
                                <Typography sx={{ fontSize: 9.5, color: 'text.secondary', fontFamily: 'monospace' }} noWrap>
                                  {item.aasName}
                                </Typography>
                                <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>·</Typography>
                                <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>
                                  {item.author}
                                </Typography>
                              </Stack>
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                ));
              })()
            )}
          </Box>
        </Paper>
      </Box>

    </Box>
  );
}
