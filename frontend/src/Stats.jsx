import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Container, Typography, Box, Card, CardContent, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Button, Chip, CircularProgress,
  TablePagination, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, TextField, Alert, Tooltip, IconButton
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StorageIcon from '@mui/icons-material/Storage';
import SearchIcon from '@mui/icons-material/Search';
import PeopleIcon from '@mui/icons-material/People';
import BarChartIcon from '@mui/icons-material/BarChart';
import TimelineIcon from '@mui/icons-material/Timeline';
import AssessmentIcon from '@mui/icons-material/Assessment';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Legend,
  ResponsiveContainer
} from 'recharts';

const MONTHS = [
  { value: '01', label: 'Enero' }, { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' }, { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' }, { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' }, { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' }, { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
];

const PIE_COLORS = ['#d32f2f', '#f57c00', '#388e3c'];
const LINE_COLOR = '#1976d2';
const BAR_COLOR = '#1976d2';

export default function Stats() {
  const [data, setData] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [deleteDialog, setDeleteDialog] = useState({ open: false, type: null });
  const [confirmText, setConfirmText] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef(null);
  const navigate = useNavigate();

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    params.set('page', page + 1);
    params.set('pageSize', rowsPerPage);
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    return `/api/admin/site-stats?${params.toString()}`;
  }, [page, rowsPerPage, desde, hasta]);

  const fetchAll = useCallback(async () => {
    try {
      const [statsRes, chartRes] = await Promise.all([
        fetch(buildUrl()),
        fetch('/api/admin/chart-data')
      ]);
      if (statsRes.status === 401) return navigate('/admin/login');
      if (!statsRes.ok || !chartRes.ok) throw new Error('Error al cargar datos');
      const [statsJson, chartJson] = await Promise.all([statsRes.json(), chartRes.json()]);
      setData(statsJson);
      setChartData(chartJson);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [buildUrl, navigate]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleFilter = () => {
    setPage(0);
    setLoading(true);
    fetchAll();
  };

  const handleChangePage = (_, newPage) => setPage(newPage);

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const openDeleteDialog = (type) => {
    setConfirmText('');
    setSelectedYear(new Date().getFullYear());
    setSelectedMonths([]);
    setDeleteDialog({ open: true, type });
  };

  const closeDeleteDialog = () => {
    setDeleteDialog({ open: false, type: null });
    setConfirmText('');
  };

  const handleDeleteLogs = async () => {
    const { type } = deleteDialog;
    try {
      let body;
      if (type === 'all') {
        body = { deleteAll: true };
      } else if (type === 'byYear') {
        body = { deleteYear: selectedYear };
      } else if (type === 'months') {
        const currentYear = new Date().getFullYear();
        body = { deleteMonths: selectedMonths.map(m => `${currentYear}-${m}`) };
      }
      const res = await fetch('/api/admin/delete-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Error al eliminar');
      closeDeleteDialog();
      setPage(0);
      fetchAll();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
        onclone: (doc) => {
          doc.querySelectorAll('.pdf-hide').forEach(el => el.remove());
          const header = doc.createElement('div');
          header.style.cssText = 'text-align:center;margin-bottom:20px;padding-bottom:15px;border-bottom:2px solid #1976d2';
          header.innerHTML = `
            <h1 style="margin:0;font-size:22px;color:#1976d2;font-family:sans-serif">El Ruc | Portal de Consulta RUC Paraguay</h1>
            <p style="margin:4px 0 0;font-size:12px;color:#555;font-family:sans-serif">Datos públicos del padrón oficial de contribuyentes DNIT</p>
            <p style="margin:2px 0 0;font-size:11px;color:#888;font-family:sans-serif">www.elruc.com.py</p>
            <hr style="margin:12px auto 10px;width:60%;border:none;border-top:1px solid #ccc">
            <h2 style="margin:0;font-size:16px;color:#333;font-family:sans-serif">Informes y Estadísticas</h2>
            <p style="margin:3px 0 0;font-size:11px;color:#666;font-family:sans-serif">Registro de consultas y visitantes del sitio</p>
          `;
          const container = doc.querySelector('[data-pdf-container]');
          if (container) container.insertBefore(header, container.firstChild);
        }
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      const now = dayjs().format('YYYY-MM-DD_HH-mm');
      const suffix = desde || hasta ? `_${desde || 'inicio'}_${hasta || 'fin'}` : '';
      pdf.save(`informe_estadisticas_${now}${suffix}.pdf`);
    } catch (err) {
      console.error('Error al exportar PDF:', err);
    } finally {
      setExporting(false);
    }
  };

  const renderDeleteDialog = () => {
    const { type } = deleteDialog;

    if (type === 'all') {
      return (
        <Dialog open={deleteDialog.open} onClose={closeDeleteDialog}>
          <DialogTitle sx={{ color: 'error.main' }}>Vaciar todos los registros</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
              Estás a punto de eliminar <strong>todos</strong> los registros de consultas. Esta acción no se puede deshacer.
            </DialogContentText>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Se eliminarán permanentemente todos los registros de la base de datos.
            </Alert>
            <TextField
              fullWidth size="small"
              label='Escribí "ELIMINAR" para confirmar'
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDeleteDialog}>Cancelar</Button>
            <Button onClick={handleDeleteLogs} color="error" variant="contained" disabled={confirmText !== 'ELIMINAR'}>Eliminar todo</Button>
          </DialogActions>
        </Dialog>
      );
    }

    if (type === 'byYear') {
      const years = [new Date().getFullYear()];
      return (
        <Dialog open={deleteDialog.open} onClose={closeDeleteDialog}>
          <DialogTitle>Eliminar por año</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>Eliminar todos los registros del año seleccionado:</DialogContentText>
            <TextField select fullWidth size="small" label="Seleccionar año" value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              SelectProps={{ native: true }} InputLabelProps={{ shrink: true }}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDeleteDialog}>Cancelar</Button>
            <Button onClick={handleDeleteLogs} color="error" variant="contained">Eliminar</Button>
          </DialogActions>
        </Dialog>
      );
    }

    if (type === 'months') {
      const currentYear = new Date().getFullYear();
      return (
        <Dialog open={deleteDialog.open} onClose={closeDeleteDialog}>
          <DialogTitle>Vaciar por meses</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>Eliminar todos los registros del mes seleccionado de {currentYear}:</DialogContentText>
            <TextField select fullWidth size="small" label="Seleccionar mes"
              value={selectedMonths[0] || ''}
              onChange={(e) => setSelectedMonths([e.target.value])}
              SelectProps={{ native: true }} InputLabelProps={{ shrink: true }}>
              <option value="" disabled>Seleccioná un mes</option>
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDeleteDialog}>Cancelar</Button>
            <Button onClick={handleDeleteLogs} color="error" variant="contained" disabled={selectedMonths.length === 0}>Eliminar</Button>
          </DialogActions>
        </Dialog>
      );
    }

    return null;
  };

  if (loading) return (
    <Container maxWidth="lg" sx={{ py: 4, textAlign: 'center' }}>
      <CircularProgress />
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Cargando estadísticas...</Typography>
    </Container>
  );

  return (
    <>
      <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>
      <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <AssessmentIcon color="primary" sx={{ fontSize: 32 }} />
            <Box>
              <Typography variant="h5" color="primary" fontWeight="bold">Informes y Estadísticas</Typography>
              <Typography variant="body2" color="text.secondary">Registro de consultas y visitantes del sitio.</Typography>
            </Box>
          </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={handleExportPDF} disabled={exporting}>
            {exporting ? 'Exportando...' : 'Exportar PDF'}
          </Button>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/admin/import')}>Volver al panel</Button>
        </Box>
      </Box>

      {error && (
        <Card sx={{ p: 3, mb: 3, bgcolor: '#fff3e0', borderRadius: 3 }}>
          <Typography color="error">{error}</Typography>
        </Card>
      )}

      {data && (
        <div ref={reportRef} data-pdf-container>
          {/* Summary Cards */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <Card sx={{ flex: 1, minWidth: 200, p: 2, borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SearchIcon color="primary" /><Typography variant="body2" color="text.secondary">Consultas hoy</Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold" sx={{ mt: 1 }}>{data.queriesToday ?? '—'}</Typography>
            </Card>
            <Card sx={{ flex: 1, minWidth: 200, p: 2, borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PeopleIcon color="secondary" /><Typography variant="body2" color="text.secondary">Visitantes únicos hoy</Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold" sx={{ mt: 1 }}>{data.visitorsToday ?? '—'}</Typography>
            </Card>
            <Card sx={{ flex: 1, minWidth: 200, p: 2, borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BarChartIcon color="success" /><Typography variant="body2" color="text.secondary">Total consultas</Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold" sx={{ mt: 1 }}>{data.totalQueries ?? '—'}</Typography>
            </Card>
          </Box>

          {/* Charts */}
          {chartData && (
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              {/* Consultas por día */}
              <Card sx={{ flex: '1 1 48%', minWidth: 300, p: 2, borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TimelineIcon color="primary" /><Typography variant="subtitle2" fontWeight="bold">Consultas por día (últ. 30 días)</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Muestra el volumen diario de búsquedas realizadas en los últimos 30 días.</Typography>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData.queriesByDay}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dia" tick={{ fontSize: 10 }} tickFormatter={(v) => dayjs(v).format('DD/MM')} />
                    <YAxis allowDecimals={false} />
                    <ReTooltip />
                    <Line type="monotone" dataKey="total" stroke={LINE_COLOR} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              {/* Términos más buscados */}
              <Card sx={{ flex: '1 1 48%', minWidth: 300, p: 2, borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SearchIcon color="primary" /><Typography variant="subtitle2" fontWeight="bold">Términos más buscados (top 10)</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Las 10 palabras o RUC más consultados por los usuarios.</Typography>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData.topTerms} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis dataKey="termino" type="category" tick={{ fontSize: 10 }} width={120} />
                    <ReTooltip />
                    <Bar dataKey="total" fill={BAR_COLOR} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Horas pico */}
              <Card sx={{ flex: '1 1 48%', minWidth: 300, p: 2, borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BarChartIcon color="primary" /><Typography variant="subtitle2" fontWeight="bold">Consultas por hora del día</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Distribución de búsquedas según la hora del día en que se realizan.</Typography>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData.queriesByHour}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hora" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}:00`} />
                    <YAxis allowDecimals={false} />
                    <ReTooltip />
                    <Bar dataKey="total" fill={BAR_COLOR} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Distribución de resultados */}
              <Card sx={{ flex: '1 1 48%', minWidth: 300, p: 2, borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <StorageIcon color="primary" /><Typography variant="subtitle2" fontWeight="bold">Resultados por consulta</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Cantidad de contribuyentes que devuelve cada búsqueda.</Typography>
                {chartData.resultsDistribution.map((d, idx) => (
                  <Box key={d.rango} sx={{ mb: 0 }}>
                    <Typography variant="caption" color="text.secondary">{d.rango}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{
                        flexGrow: 1, height: 15, borderRadius: 1,
                        background: `linear-gradient(90deg, ${['#d32f2f','#f57c00','#fbc02d','#7cb342','#388e3c'][idx]} ${Math.min(100, (d.total / Math.max(...chartData.resultsDistribution.map(x => x.total))) * 100)}%, #e0e0e0 ${Math.min(100, (d.total / Math.max(...chartData.resultsDistribution.map(x => x.total))) * 100)}%)`
                      }} />
                      <Typography variant="body2" fontWeight="bold">{d.total}</Typography>
                    </Box>
                  </Box>
                ))}
              </Card>
            </Box>
          )}

          {/* Logs Table */}
          <Card sx={{ borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <StorageIcon /><Typography variant="h6" fontWeight="bold">Últimas consultas</Typography>
                </Box>
                <Box className="pdf-hide" sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <DatePicker label="Desde" value={desde ? dayjs(desde) : null}
                    onChange={(v) => setDesde(v ? v.format('YYYY-MM-DD') : '')}
                    slotProps={{ textField: { size: 'small', sx: { width: 160 } } }} />
                  <DatePicker label="Hasta" value={hasta ? dayjs(hasta) : null}
                    onChange={(v) => setHasta(v ? v.format('YYYY-MM-DD') : '')}
                    slotProps={{ textField: { size: 'small', sx: { width: 160 } } }} />
                  <Button variant="contained" size="small" onClick={handleFilter}>Filtrar</Button>
                  {(desde || hasta) && (
                    <Button variant="text" size="small" onClick={() => { setDesde(''); setHasta(''); setPage(0); setLoading(true); }}>Limpiar</Button>
                  )}
                  <Tooltip title="Eliminar registros">
                    <IconButton color="error" onClick={() => openDeleteDialog('menu')}><DeleteSweepIcon /></IconButton>
                  </Tooltip>
                </Box>
              </Box>
              {data.recentQueries && data.recentQueries.length > 0 ? (
                <>
                  <TableContainer component={Paper} sx={{ boxShadow: 'none' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>Fecha</strong></TableCell>
                          <TableCell><strong>Término</strong></TableCell>
                          <TableCell><strong>Resultados</strong></TableCell>
                          <TableCell><strong>IP</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.recentQueries.map((q) => (
                          <TableRow key={q.id}>
                            <TableCell>{new Date(q.fecha).toLocaleString('es-PY', { timeZone: 'America/Asuncion', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</TableCell>
                            <TableCell><Chip label={q.termino} size="small" variant="outlined" /></TableCell>
                            <TableCell>{q.resultados}</TableCell>
                            <TableCell><Typography variant="caption">{(q.ip || '').replace(/^::ffff:/, '')}</Typography></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <TablePagination component="div" count={data.totalRecords || 0} page={page}
                    onPageChange={handleChangePage} rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage} rowsPerPageOptions={[10, 15, 25, 50]}
                    labelRowsPerPage="Filas por página"
                    labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`} />
                </>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <StorageIcon sx={{ fontSize: 48, color: '#ccc' }} />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>No hay registros de consultas aún.</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete menu dialog */}
      <Dialog open={deleteDialog.open && deleteDialog.type === 'menu'} onClose={closeDeleteDialog}>
        <DialogTitle>Eliminar registros</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>Seleccioná qué registros deseas eliminar:</DialogContentText>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Button variant="outlined" color="error" startIcon={<DeleteSweepIcon />} onClick={() => openDeleteDialog('all')} sx={{ justifyContent: 'flex-start' }}>Vaciar todo</Button>
            <Button variant="outlined" color="warning" startIcon={<DeleteSweepIcon />} onClick={() => openDeleteDialog('byYear')} sx={{ justifyContent: 'flex-start' }}>Eliminar por año</Button>
            <Button variant="outlined" color="warning" startIcon={<DeleteSweepIcon />} onClick={() => openDeleteDialog('months')} sx={{ justifyContent: 'flex-start' }}>Vaciar por meses</Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog}>Cancelar</Button>
        </DialogActions>
      </Dialog>

      {renderDeleteDialog()}
    </Container>
    </>
  );
}
