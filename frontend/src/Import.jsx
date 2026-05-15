import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { 
  Container, Typography, Box, Button, Card, CardContent, CircularProgress, 
  Alert, TextField, Grid, IconButton, Tooltip, FormGroup, FormControlLabel, Checkbox,
  Dialog, DialogTitle, DialogContent, DialogActions, LinearProgress, Chip,
  TableContainer, Table, TableHead, TableRow, TableBody, TableCell, Paper, Snackbar
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import LogoutIcon from '@mui/icons-material/Logout';
import LinkIcon from '@mui/icons-material/Link';
import StorageIcon from '@mui/icons-material/Storage';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DeleteIcon from '@mui/icons-material/Delete';
import UpdateIcon from '@mui/icons-material/Update';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import SpeedIcon from '@mui/icons-material/Speed';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import BuildIcon from '@mui/icons-material/Build';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import CloseIcon from '@mui/icons-material/Close';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import GroupsIcon from '@mui/icons-material/Groups';

export default function Import() {
  const [files, setFiles] = useState([]);
  const [url, setUrl] = useState(localStorage.getItem('dnit_url') || '');
  const [scannedItems, setScannedItems] = useState([]);
  const [selectedLinks, setSelectedLinks] = useState({});
  const [isEditingUrl, setIsEditingUrl] = useState(!localStorage.getItem('dnit_url'));
  const [stats, setStats] = useState({ total: 0 });
  const [lastUpdate, setLastUpdate] = useState(localStorage.getItem('dnit_last_update') || 'No registrada');
  const [prevTotal, setPrevTotal] = useState(null);
  const [padronDate, setPadronDate] = useState(localStorage.getItem('dnit_padron_date') || '');
  const [recordsAdded, setRecordsAdded] = useState(null);
  const [siteStats, setSiteStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progressModal, setProgressModal] = useState({ open: false, text: '', value: 0, icon: null });
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [filesModalOpen, setFilesModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const abortRef = useRef(null);
  const fileInputRef = useRef(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarInfo, setSnackbarInfo] = useState({ message: '', severity: 'success' });

  const showSnackbar = (msg, severity = 'success') => {
    setSnackbarInfo({ message: msg, severity });
    setSnackbarOpen(true);
  };

  useEffect(() => {
    if (message) showSnackbar(message, 'success');
  }, [message]);

  useEffect(() => {
    if (error) showSnackbar(error, 'error');
  }, [error]);

  const [txtFiles, setTxtFiles] = useState([]);
  const [compareProgress, setCompareProgress] = useState({ open: false, value: 0, text: '' });
  const compareProgressRef = useRef(null);
  const [previewResult, setPreviewResult] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [batchData, setBatchData] = useState({ nuevos: [], modificados: [] });
  const [batchPage, setBatchPage] = useState(0);
  const [selectedRucs, setSelectedRucs] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [importConfirming, setImportConfirming] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const batchLimit = 100;

  const navigate = useNavigate();

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        return data;
      } else if (res.status === 401) {
        navigate('/admin/login');
      }
    } catch (err) {
      console.error(err);
    }
    return null;
  };

  const fetchSiteStats = async () => {
    try {
      const res = await fetch('/api/admin/site-stats');
      if (res.ok) {
        const data = await res.json();
        setSiteStats(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchSiteStats();
    fetchFeriados();
  }, []);

  const handleSuccessUpdate = async (msg, dnitDate, prevTotalVal) => {
    const now = new Date().toLocaleString('es-PY');
    localStorage.setItem('dnit_last_update', now);
    setLastUpdate(now);
    if (dnitDate) {
      localStorage.setItem('dnit_padron_date', dnitDate);
      setPadronDate(dnitDate);
    }
    const newData = await fetchStats();
    if (prevTotalVal != null && newData) {
      const newCount = Number(newData.total) - prevTotalVal;
      setRecordsAdded(newCount);
      if (newCount > 0) {
        setMessage(`${msg} (+${newCount.toLocaleString('es-PY')} registros nuevos).`);
        return;
      }
    }
    setMessage(msg);
  };

  const handleFileChange = (e, append = false) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => append ? [...prev, ...newFiles] : newFiles);
      setMessage(null);
      setError(null);
      if (!append) setFilesModalOpen(true);
    }
  };

  const handleRemoveFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadFiles = async () => {
    if (files.length === 0) return;

    setFilesModalOpen(false);
    const controller = new AbortController();
    abortRef.current = controller;
    setCancelling(false);

    const prevTotalCapture = Number(stats.total);
    setPrevTotal(prevTotalCapture);
    setProgressModal({ open: true, text: 'Iniciando subida...', value: 0, icon: null });

    try {
      let processed = 0;
      const total = files.length;

      for (let i = 0; i < total; i++) {
        if (controller.signal.aborted) break;

        const file = files[i];
        const base = Math.round((i / total) * 100);
        const fileNum = i + 1;

        setProgressModal({ open: true, text: `${fileNum}/${total} Subiendo ${file.name}...`, value: base, icon: <CloudUploadIcon /> });

        const formData = new FormData();
        formData.append('file', file);

        let fakeProgress = base;
        const animTimer = setInterval(() => {
          fakeProgress = Math.min(fakeProgress + 1, base + 40);
          setProgressModal(prev => ({ ...prev, value: fakeProgress }));
        }, 2000);

        const response = await fetch('/api/upload', { method: 'POST', body: formData, signal: controller.signal });
        clearInterval(animTimer);

        setProgressModal({ open: true, text: `${fileNum}/${total} Procesando e insertando ${file.name}...`, value: base + 60, icon: <StorageIcon /> });

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 401) { setProgressModal({ open: false, text: '', value: 0, icon: null }); return navigate('/admin/login'); }
          throw new Error(data.error || `Error en el archivo ${file.name}`);
        }

        setProgressModal({ open: true, text: `${fileNum}/${total} Limpiando archivos temporales...`, value: base + 90, icon: <CleaningServicesIcon /> });
        processed++;
      }

      if (controller.signal.aborted) {
        setProgressModal({ open: false, text: '', value: 0, icon: null });
        setMessage('Proceso cancelado por el usuario.');
      } else {
        setProgressModal({ open: true, text: 'Sincronización completada.', value: 100, icon: <CheckCircleIcon color="success" /> });
        setTimeout(() => {
          setProgressModal({ open: false, text: '', value: 0, icon: null });
          handleSuccessUpdate(`Se procesaron correctamente ${processed} archivos.`, undefined, prevTotalCapture);
          setFiles([]);
        }, 2000);
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        setProgressModal({ open: false, text: '', value: 0, icon: null });
        setMessage('Proceso cancelado por el usuario.');
      } else {
        setProgressModal({ open: false, text: '', value: 0, icon: null });
        setError(err.message);
      }
    } finally {
      abortRef.current = null;
      setCancelling(false);
      setLoading(false);
    }
  };

  const handleUrlScan = async () => {
    if (!url) return;
    setLoading(true);
    setMessage(null);
    setError(null);
    setScannedItems([]);
    setSelectedLinks({});

    try {
      const response = await fetch('/api/scan-url', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Ocurrió un error al procesar la URL');
      
      setScannedItems(data.links);
      const dates = [...new Set(data.links.map(i => i.description.replace('Actualizado al ', '').replace('.', '').trim()))];
      const latestPadronDate = dates.sort().pop() || '';
      
      if (latestPadronDate && latestPadronDate === padronDate) {
        setMessage(`El padrón ya está actualizado al ${latestPadronDate}. No se requiere sincronización.`);
        setScannedItems([]);
      } else {
        setScannedItems(data.links);
        setScanModalOpen(true);
        if (padronDate) {
          setMessage(`Nueva actualización disponible: ${latestPadronDate} (anterior: ${padronDate}). ${data.links.length} archivos encontrados.`);
        } else {
          setMessage(`Escaneo completo: ${data.links.length} archivos encontrados.`);
        }
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessSelectedLinks = async () => {
    const linksToProcess = Object.keys(selectedLinks).filter(link => selectedLinks[link]);
    if (linksToProcess.length === 0) {
      setError("Por favor, seleccione al menos un archivo ZIP para procesar.");
      return;
    }

    const prevTotalCapture = Number(stats.total);
    setPrevTotal(prevTotalCapture);
    setLoading(true);
    setScanModalOpen(false);
    const controller = new AbortController();
    abortRef.current = controller;
    setCancelling(false);

    setProgressModal({ open: true, text: 'Iniciando proceso...', value: 0, icon: null });

    const dnitDates = [...new Set(scannedItems.map(i => i.description.replace('Actualizado al ', '').replace('.', '').trim()))];
    const latestPadronDate = dnitDates.sort().pop() || '';

    try {
      let processed = 0;
      const total = linksToProcess.length;

      for (let i = 0; i < total; i++) {
        if (controller.signal.aborted) break;

        const link = linksToProcess[i];
        const item = scannedItems.find(s => s.link === link);
        const title = item?.title || `archivo ${i + 1}`;
        const base = Math.round((i / total) * 100);
        const fileNum = i + 1;

        setProgressModal({ open: true, text: `${fileNum}/${total} Descargando ${title}...`, value: base, icon: <CloudDownloadIcon /> });

        let fakeProgress = base;
        const animTimer = setInterval(() => {
          fakeProgress = Math.min(fakeProgress + 1, base + 60);
          setProgressModal(prev => ({ ...prev, value: fakeProgress }));
        }, 2000);

        const response = await fetch('/api/import-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ links: [link] }),
          signal: controller.signal,
        });

        clearInterval(animTimer);

        setProgressModal({ open: true, text: `${fileNum}/${total} Insertando ${title} en la base de datos...`, value: base + 70, icon: <StorageIcon /> });

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 401) { setProgressModal({ open: false, text: '', value: 0, icon: null }); return navigate('/admin/login'); }
          throw new Error(data.error || `Error al procesar ${title}`);
        }

        setProgressModal({ open: true, text: `${fileNum}/${total} Limpiando archivos temporales...`, value: base + 90, icon: <CleaningServicesIcon /> });
        processed++;
      }

      if (controller.signal.aborted) {
        setProgressModal({ open: false, text: '', value: 0, icon: null });
        setMessage('Proceso cancelado por el usuario.');
      } else {
        setProgressModal({ open: true, text: 'Sincronización completada.', value: 100, icon: <CheckCircleIcon color="success" /> });
        setTimeout(() => {
          setProgressModal({ open: false, text: '', value: 0, icon: null });
          handleSuccessUpdate(`Se sincronizaron correctamente ${processed} archivos.`, latestPadronDate, prevTotalCapture);
          setScannedItems([]);
          setSelectedLinks({});
        }, 2000);
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        setProgressModal({ open: false, text: '', value: 0, icon: null });
        setMessage('Proceso cancelado por el usuario.');
      } else {
        setProgressModal({ open: false, text: '', value: 0, icon: null });
        setError(err.message);
      }
    } finally {
      abortRef.current = null;
      setCancelling(false);
      setLoading(false);
    }
  };

  const handleCancelProcess = () => {
    if (abortRef.current) {
      setCancelling(true);
      abortRef.current.abort();
    }
  };

  const handleTxtFilesChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setTxtFiles(prev => [...prev, ...newFiles]);
      setPreviewResult(null);
      setBatchData({ nuevos: [], modificados: [] });
      setSelectedRucs(new Set());
      setSelectAll(false);
      setMessage(null);
      setError(null);
    }
  };

  const handleRemoveTxtFile = (index) => {
    setTxtFiles(prev => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) {
        setPreviewResult(null);
        setBatchData({ nuevos: [], modificados: [] });
        setSelectedRucs(new Set());
      }
      return next;
    });
  };

  const handlePreview = async () => {
    if (txtFiles.length === 0) return;
    setPreviewLoading(true);
    setError(null);
    setMessage(null);
    setCompareProgress({ open: true, value: 0, text: 'Iniciando comparación...' });

    const interval = setInterval(() => {
      setCompareProgress(prev => ({
        ...prev,
        value: Math.min(prev.value + Math.random() * 8, 85)
      }));
    }, 400);
    compareProgressRef.current = interval;

    try {
      const formData = new FormData();
      txtFiles.forEach(f => formData.append('files', f));
      const res = await fetch('/api/admin/import-preview', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      clearInterval(interval);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al procesar archivo(s)');
      }
      setCompareProgress({ open: true, value: 100, text: 'Comparación completada' });
      const data = await res.json();
      setTimeout(() => {
        setCompareProgress(prev => ({ ...prev, open: false }));
      }, 800);
      setPreviewResult(data);
      setBatchPage(0);
      setSelectedRucs(new Set());
      setSelectAll(false);
      fetchBatch(data.sessionId, 0);
    } catch (err) {
      clearInterval(interval);
      setError(err.message);
      setCompareProgress({ open: false, value: 0, text: '' });
    } finally {
      setPreviewLoading(false);
    }
  };

  const fetchBatch = async (sessionId, page) => {
    try {
      const res = await fetch(`/api/admin/import-preview-batch?sessionId=${sessionId}&page=${page}&limit=${batchLimit}`, {
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) setBatchData(data);
    } catch (err) {
      console.error('Error fetching batch:', err);
    }
  };

  const handleBatchPageChange = (newPage) => {
    setBatchPage(newPage);
    setSelectedRucs(new Set());
    setSelectAll(false);
    if (previewResult) fetchBatch(previewResult.sessionId, newPage);
  };

  const handleToggleRuc = (ruc) => {
    setSelectedRucs(prev => {
      const next = new Set(prev);
      if (next.has(ruc)) next.delete(ruc);
      else next.add(ruc);
      return next;
    });
    setSelectAll(false);
  };

  const handleSelectAllPage = (checked, pageRows) => {
    if (checked) {
      const rucs = pageRows.filter(r => r.ruc).map(r => r.ruc);
      setSelectedRucs(prev => {
        const next = new Set(prev);
        rucs.forEach(r => next.add(r));
        return next;
      });
    } else {
      const rucs = pageRows.filter(r => r.ruc).map(r => r.ruc);
      setSelectedRucs(prev => {
        const next = new Set(prev);
        rucs.forEach(r => next.delete(r));
        return next;
      });
    }
    setSelectAll(checked);
  };

  const handleImportSelected = async () => {
    if (selectedRucs.size === 0) return;
    setImportConfirming(true);
    try {
      const res = await fetch('/api/admin/import-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId: previewResult.sessionId, batchRucs: Array.from(selectedRucs) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setMessage(`Importación completada: ${selectedRucs.size} registro(s) procesado(s).`);
      setPreviewResult(null);
      setBatchData({ nuevos: [], modificados: [] });
      setTxtFiles([]);
      setSelectedRucs(new Set());
      fetchStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setImportConfirming(false);
    }
  };

  const handleImportAll = async () => {
    if (!previewResult) return;
    setImportConfirming(true);
    try {
      const res = await fetch('/api/admin/import-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId: previewResult.sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setMessage(`Importación completada: ${previewResult.nuevos + previewResult.modificados} registro(s) procesado(s).`);
      setPreviewResult(null);
      setBatchData({ nuevos: [], modificados: [] });
      setTxtFiles([]);
      setSelectedRucs(new Set());
      fetchStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setImportConfirming(false);
    }
  };

  const handleCancelPreview = async () => {
    if (!previewResult) return;
    try {
      await fetch('/api/admin/import-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId: previewResult.sessionId }),
      });
    } catch (err) {
      console.error('Error canceling:', err);
    }
    setPreviewResult(null);
    setBatchData({ nuevos: [], modificados: [] });
    setTxtFiles([]);
    setSelectedRucs(new Set());
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    navigate('/admin/login');
  };

  const handleSaveUrl = () => {
    localStorage.setItem('dnit_url', url);
    setIsEditingUrl(false);
  };

  const handleLinkSelectionChange = (item) => {
    setSelectedLinks(prev => ({
      ...prev,
      [item.link]: !prev[item.link]
    }));
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      const allSelected = scannedItems.reduce((acc, item) => {
        acc[item.link] = true;
        return acc;
      }, {});
      setSelectedLinks(allSelected);
    } else {
      setSelectedLinks({});
    }
  };

  const [scrapingNews, setScrapingNews] = useState(false);
  const [scrapingNorm, setScrapingNorm] = useState(false);
  const [lastNewsUpdate, setLastNewsUpdate] = useState(localStorage.getItem('last_news_update') || null);
  const [lastNormUpdate, setLastNormUpdate] = useState(localStorage.getItem('last_norm_update') || null);
  const [dbStats, setDbStats] = useState(null);
  const [dbMaintenance, setDbMaintenance] = useState({ loading: false, action: null });
  const [feriados, setFeriados] = useState([]);
  const [feriadoDialogOpen, setFeriadoDialogOpen] = useState(false);
  const [nuevoFeriado, setNuevoFeriado] = useState({ fecha: '', descripcion: '' });
  const [generandoFeriados, setGenerandoFeriados] = useState(false);

  const handleScrapeNoticias = async () => {
    setScrapingNews(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/dnit/scrape-noticias', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al scrapear');
      const now = new Date().toLocaleString('es-PY', { timeZone: 'America/Asuncion' });
      setLastNewsUpdate(now);
      localStorage.setItem('last_news_update', now);
      setMessage(`Noticias actualizadas: ${data.message}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setScrapingNews(false);
    }
  };

  const handleScrapeNormativas = async () => {
    setScrapingNorm(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/dnit/scrape-normativas', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al scrapear');
      const now = new Date().toLocaleString('es-PY', { timeZone: 'America/Asuncion' });
      setLastNormUpdate(now);
      localStorage.setItem('last_norm_update', now);
      setMessage(`Normativas actualizadas: ${data.message}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setScrapingNorm(false);
    }
  };

  const fetchFeriados = async () => {
    try {
      const res = await fetch('/api/admin/feriados', { credentials: 'include' });
      if (res.ok) setFeriados(await res.json());
    } catch (err) { console.error(err); }
  };

  const handleGenerarFeriados = async () => {
    setGenerandoFeriados(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/feriados/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ anio: new Date().getFullYear() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar');
      setMessage(data.message);
      fetchFeriados();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerandoFeriados(false);
    }
  };

  const handleAgregarFeriado = async () => {
    if (!nuevoFeriado.fecha || !nuevoFeriado.descripcion) return;
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/feriados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(nuevoFeriado),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al agregar');
      setMessage(data.message);
      setFeriadoDialogOpen(false);
      setNuevoFeriado({ fecha: '', descripcion: '' });
      fetchFeriados();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEliminarFeriado = async (id) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/feriados/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        setMessage('Feriado eliminado');
        fetchFeriados();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchDbStats = async () => {
    try {
      const res = await fetch('/api/admin/db-stats');
      if (res.ok) { setDbStats(await res.json()); }
      else if (res.status === 401) { navigate('/admin/login'); }
    } catch (err) { console.error(err); }
  };

  const handleDbMaintenance = async (action) => {
    setDbMaintenance({ loading: true, action });
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/db-maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setMessage(data.message);
      fetchDbStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setDbMaintenance({ loading: false, action: null });
    }
  };

  useEffect(() => { fetchDbStats(); }, []);

  // Estilos de botones y tarjetas con efecto flotante
  const floatingBtnStyle = {
    borderRadius: 8,
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    transition: 'all 0.3s ease',
    '&:hover': {
      boxShadow: '0 8px 15px rgba(0,0,0,0.2)',
      transform: 'translateY(-2px)'
    }
  };

  const cardStyle = {
    p: 2, 
    display: 'flex', 
    flexDirection: 'column', 
    borderRadius: 4, 
    boxShadow: '0 8px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)',
    transition: 'all 0.3s ease',
    border: '1px solid #eaeaea',
    '&:hover': { boxShadow: '0 16px 48px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.1)', transform: 'translateY(-4px)' }
  };

  return (
    <>
      <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>
      <Container maxWidth="lg" sx={{ py: 2 }}>
      <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <GroupsIcon color="primary" sx={{ fontSize: 32 }} />
            <Box>
              <Typography variant="h5" color="primary" fontWeight="bold">
                Padrón de Contribuyentes (DNIT)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Base de datos de RUCs para autocompletado. Sincronice el directorio oficial.
              </Typography>
            </Box>
          </Box>
        </Box>
        <Button variant="outlined" color="error" size="small" sx={floatingBtnStyle} startIcon={<LogoutIcon />} onClick={handleLogout}>
          Salir
        </Button>
      </Box>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {/* DASHBOARD: ESTADO DE LA BASE DE DATOS */}
        <Grid item xs={12} md={6}>
          <Card sx={{ p: 2, bgcolor: 'primary.main', color: 'white', borderRadius: 3, boxShadow: '0 10px 30px rgba(0,56,168,0.2)', height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <StorageIcon sx={{ fontSize: 36, opacity: 0.9 }} />
              <Box>
                <Typography variant="h6" fontWeight="bold">Estado de la Base de Datos</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography variant="body2" sx={{ opacity: 0.9, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CheckCircleIcon sx={{ fontSize: 16 }} /> 
                    Registros indexados: <b>{Number(stats.total).toLocaleString('es-PY')} contribuyentes</b>
                  </Typography>
                  {recordsAdded !== null && (
                    <Typography variant="body2" sx={{ opacity: 0.9, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      Registros agregados: <b>{recordsAdded.toLocaleString('es-PY')} contribuyentes</b>
                    </Typography>
                  )}
                </Box>
                <Typography variant="caption" sx={{ opacity: 0.8, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <UpdateIcon sx={{ fontSize: 14 }} /> Última sincronización: <b>{lastUpdate}</b>
                </Typography>
                {padronDate && (
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Padrón DNIT: <b>{padronDate}</b>
                  </Typography>
                )}
              </Box>
            </Box>
          </Card>
        </Grid>

        {/* ESTADÍSTICAS DEL SITIO */}
        <Grid item xs={12} md={6}>
          <Card sx={{ p: 2, bgcolor: '#1b5e20', color: 'white', borderRadius: 3, boxShadow: '0 10px 30px rgba(27,94,32,0.2)', height: '100%' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 1, alignItems: 'center' }}>
                <StorageIcon sx={{ fontSize: 36, opacity: 0.9 }} />
                <Box sx={{ flexGrow: 1, minWidth: { xs: 160, sm: 'auto' } }}>
                  <Typography variant="h6" fontWeight="bold">Estadísticas del Sitio</Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Consultas realizadas: <b>{siteStats ? Number(siteStats.totalQueries).toLocaleString('es-PY') : '—'}</b>
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Visitantes hoy: <b>{siteStats ? siteStats.visitorsToday : '—'}</b> &middot; Consultas hoy: <b>{siteStats ? Number(siteStats.queriesToday).toLocaleString('es-PY') : '—'}</b>
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  size="small"
                  sx={{ bgcolor: 'white', color: '#1b5e20', fontWeight: 'bold', '&:hover': { bgcolor: '#e8f5e9' }, whiteSpace: 'nowrap', width: { xs: '100%', sm: 'auto' } }}
                  onClick={() => navigate('/admin/stats')}
                >
                  Ver informe completo
                </Button>
              </Box>
            </Box>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        {/* OPCIÓN 1: SUBIDA MANUAL POR LOTES */}
        <Grid item xs={12} md={6}>
          <Card sx={{ ...cardStyle, height: '100%' }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <CloudUploadIcon color="primary" />
                <Typography variant="h6" fontWeight="bold">Opción 1: Subida Manual</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Selecciona múltiples archivos ZIP de tu computadora a la vez (ej: ruc0.zip, ruc1.zip).</Typography>
              
              <Box sx={{ flexGrow: 1 }} />
              <Button variant="outlined" component="label" sx={floatingBtnStyle} startIcon={<CloudUploadIcon />}>
                Seleccionar ZIPs
                <input type="file" hidden accept=".zip" multiple onChange={handleFileChange} />
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* OPCIÓN 2: DESCARGA AUTOMÁTICA DESDE URL */}
        <Grid item xs={12} md={6}>
          <Card sx={{ ...cardStyle, height: '100%' }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <AutoAwesomeIcon color="secondary" />
                <Typography variant="h6" fontWeight="bold">Opción 2: Extracción Automática</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>El sistema detectará, descargará y procesará todos los archivos ZIP disponibles en la URL guardada.</Typography>
              
              {isEditingUrl ? (
                <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                  <TextField fullWidth size="small" label="URL de la DNIT" variant="outlined" value={url} onChange={(e) => setUrl(e.target.value)} disabled={loading}/>
                  <Tooltip title="Guardar Enlace"><IconButton color="primary" onClick={handleSaveUrl} disabled={!url} sx={{ bgcolor: '#f4f6f8' }}><SaveIcon /></IconButton></Tooltip>
                </Box>
              ) : (
                <Tooltip title={url || 'No hay URL guardada'} placement="top">
                  <Box sx={{ display: 'flex', gap: 0.5, width: '100%', alignItems: 'center', bgcolor: '#f4f6f8', p: 1, borderRadius: 2 }}>
                    <Typography variant="body2" noWrap sx={{ flexGrow: 1, opacity: 0.8 }}>{url || 'No hay URL guardada'}</Typography>
                    <Tooltip title="Editar Enlace"><IconButton color="secondary" onClick={() => setIsEditingUrl(true)} disabled={loading} size="small"><EditIcon fontSize="small" /></IconButton></Tooltip>
                  </Box>
                </Tooltip>
              )}

              <Box sx={{ flexGrow: 1 }} />
              <Button variant="contained" color="secondary" sx={{ ...floatingBtnStyle }} startIcon={<LinkIcon />} disabled={!url || isEditingUrl || loading} onClick={handleUrlScan}>
                {loading ? 'Escaneando...' : 'Escanear URL'}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {files.length > 0 && (
        <Dialog open={filesModalOpen} onClose={() => setFilesModalOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Archivos seleccionados ({files.length})</Typography>
              <IconButton size="small" onClick={() => { setFilesModalOpen(false); setFiles([]); }}>
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent dividers>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {files.map((f, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#e3f2fd', px: 1.5, py: 0.5, borderRadius: 2, border: '1px solid #bbdefb' }}>
                  <Typography variant="body2" sx={{ flexGrow: 1 }}>{f.name}</Typography>
                  <IconButton size="small" color="error" onClick={() => handleRemoveFile(i)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Box>
            <Button
              variant="outlined" size="small" sx={{ mt: 2 }}
              startIcon={<CloudUploadIcon />}
              onClick={() => fileInputRef.current?.click()}
            >
              Agregar más archivos
            </Button>
            <input type="file" hidden accept=".zip" multiple ref={fileInputRef} onChange={(e) => handleFileChange(e, true)} />
          </DialogContent>
          <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
            <Button variant="text" onClick={() => { setFilesModalOpen(false); setFiles([]); }}>Cancelar</Button>
            <Button variant="contained" color="primary" onClick={handleUploadFiles}>
              Procesar Lote de Archivos
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {scannedItems.length > 0 && !loading && (
        <Dialog open={scanModalOpen} onClose={() => setScanModalOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Archivos detectados ({scannedItems.length})</Typography>
              <IconButton size="small" onClick={() => { setScanModalOpen(false); setScannedItems([]); setSelectedLinks({}); }}>
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent dividers>
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <FormControlLabel
                label="Seleccionar todos"
                control={<Checkbox size="small" onChange={handleSelectAll} checked={scannedItems.length > 0 && Object.values(selectedLinks).filter(v => v).length === scannedItems.length} />}
                sx={{ mr: 0 }}
              />
            </Box>
            <FormGroup>
              {scannedItems.map(item => (
                <FormControlLabel
                  key={item.link}
                  control={<Checkbox size="small" checked={!!selectedLinks[item.link]} onChange={() => handleLinkSelectionChange(item)} />}
                  label={
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline', flexDirection: { xs: 'column', sm: 'row' } }}>
                      <Typography variant="body2" fontWeight="bold">{item.title}</Typography>
                      <Typography variant="caption" color="text.secondary">{item.description}</Typography>
                    </Box>
                  }
                  sx={{ mb: 0.5 }}
                />
              ))}
            </FormGroup>
          </DialogContent>
          <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
            <Button variant="text" onClick={() => { setScanModalOpen(false); setScannedItems([]); setSelectedLinks({}); }}>Cancelar</Button>
            <Button variant="contained" color="primary" onClick={handleProcessSelectedLinks} disabled={Object.values(selectedLinks).every(v => !v)}>
              {`Procesar ${Object.values(selectedLinks).filter(v => v).length} archivo(s) seleccionado(s)`}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* OPCIÓN 3: IMPORTACIÓN INTELIGENTE CON COMPARACIÓN */}
      <Card sx={{ mt: 3, p: 2, borderRadius: 3, ...cardStyle }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', textAlign: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <CompareArrowsIcon color="info" />
            <Typography variant="h6" fontWeight="bold">Importación Inteligente (Comparar)</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 500 }}>
            Subí archivos TXT (pipe-delimited) para comparar con la base de datos actual.
            Se mostrarán los registros nuevos y modificados para que selecciones cuáles importar.
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="outlined" component="label" sx={floatingBtnStyle} startIcon={<CloudUploadIcon />} disabled={previewLoading}>
              Seleccionar TXT
              <input type="file" hidden accept=".txt,.csv" multiple onChange={handleTxtFilesChange} />
            </Button>
            {txtFiles.length > 0 && (
              <>
                <Button
                  variant="contained"
                  color="info"
                  size="small"
                  sx={floatingBtnStyle}
                  startIcon={previewLoading ? <CircularProgress size={16} color="inherit" /> : <CompareArrowsIcon />}
                  onClick={handlePreview}
                  disabled={previewLoading}
                >
                  {previewLoading ? 'Comparando...' : 'Vista Previa'}
                </Button>
                <IconButton size="small" color="error" onClick={() => { setTxtFiles([]); setPreviewResult(null); }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </>
            )}
          </Box>

          {txtFiles.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5, justifyContent: 'center' }}>
              {txtFiles.map((f, i) => (
                <Chip
                  key={i}
                  label={f.name}
                  size="small"
                  color="info"
                  variant="outlined"
                  onDelete={() => handleRemoveTxtFile(i)}
                />
              ))}
            </Box>
          )}

          {previewResult && (
            <Box sx={{ bgcolor: '#f4f6f8', p: 2, borderRadius: 2, mt: 1, textAlign: 'center' }}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1, justifyContent: 'center' }}>
                <Button
                  variant="outlined"
                  color="info"
                  size="small"
                  sx={floatingBtnStyle}
                  startIcon={<PlaylistAddCheckIcon />}
                  onClick={() => setBatchDialogOpen(true)}
                  disabled={batchData.nuevos.length === 0 && batchData.modificados.length === 0}
                >
                  Ver lotes
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  sx={floatingBtnStyle}
                  onClick={handleCancelPreview}
                >
                  Cancelar
                </Button>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Chip label={`🔵 Nuevos: ${previewResult.nuevos}`} color="info" variant="filled" />
                <Chip label={`🟡 Modificados: ${previewResult.modificados}`} color="warning" variant="filled" />
                <Chip label={`⚪ Sin cambios: ${previewResult.sinCambios}`} color="default" variant="outlined" />
                <Chip label={`📦 Total archivo: ${previewResult.totalStaging}`} color="success" variant="outlined" />
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Dialog de selección por lotes */}
      <Dialog open={batchDialogOpen} onClose={() => setBatchDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" fontWeight="bold">Seleccionar registros</Typography>
            <Typography variant="caption" color="text.secondary">
              {previewResult ? `${previewResult.nuevos} nuevos, ${previewResult.modificados} modificados` : ''}
              {' — '}Seleccionados: {selectedRucs.size}
            </Typography>
          </Box>
          <IconButton onClick={() => setBatchDialogOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2, mt: 1 }}>
            <Button
              variant="contained"
              color="success"
              size="small"
              sx={floatingBtnStyle}
              onClick={handleImportSelected}
              disabled={selectedRucs.size === 0 || importConfirming}
            >
              {importConfirming ? <CircularProgress size={16} color="inherit" /> : `Importar seleccionados (${selectedRucs.size})`}
            </Button>
            <FormControlLabel
              control={<Checkbox size="small" checked={selectAll} onChange={(e) => handleSelectAllPage(e.target.checked, [...batchData.nuevos, ...batchData.modificados])} />}
              label="Seleccionar todos de esta página"
              sx={{ mr: 0 }}
            />
          </Box>

          <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell sx={{ fontWeight: 'bold' }}>RUC</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Razón Social</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Estado</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Tipo</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {batchData.nuevos.map(row => (
                  <TableRow key={row.ruc} hover selected={selectedRucs.has(row.ruc)}>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={selectedRucs.has(row.ruc)} onChange={() => handleToggleRuc(row.ruc)} />
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{row.ruc}-{row.dv}</TableCell>
                    <TableCell>{row.razon_social}</TableCell>
                    <TableCell><Chip label={row.estado || '—'} size="small" color="info" variant="outlined" /></TableCell>
                    <TableCell><Chip label="Nuevo" size="small" color="info" /></TableCell>
                  </TableRow>
                ))}
                {batchData.modificados.map(row => (
                  <TableRow key={row.ruc} hover selected={selectedRucs.has(row.ruc)}>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={selectedRucs.has(row.ruc)} onChange={() => handleToggleRuc(row.ruc)} />
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{row.ruc}-{row.dv}</TableCell>
                    <TableCell>
                      <Tooltip title={`Actual: ${row.actual_razon || '—'}`}>
                        <span>{row.razon_social}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={row.actual_estado ? `Actual: ${row.actual_estado}` : ''}>
                        <span><Chip label={row.estado || '—'} size="small" color="warning" variant="outlined" /></span>
                      </Tooltip>
                    </TableCell>
                    <TableCell><Chip label="Modificado" size="small" color="warning" /></TableCell>
                  </TableRow>
                ))}
                {batchData.nuevos.length === 0 && batchData.modificados.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                      <Typography color="text.secondary">No hay registros nuevos o modificados en esta página</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Button disabled={batchPage === 0} onClick={() => handleBatchPageChange(batchPage - 1)} size="small">
              Anterior
            </Button>
            <Typography variant="body2" sx={{ mx: 2, alignSelf: 'center' }}>
              Página {batchPage + 1}
            </Typography>
            <Button
              disabled={batchData.nuevos.length < batchLimit && batchData.modificados.length < batchLimit}
              onClick={() => handleBatchPageChange(batchPage + 1)}
              size="small"
            >
              Siguiente
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBatchDialogOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Card sx={{ mt: 3, p: 2, borderRadius: 3, ...cardStyle }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <NewReleasesIcon color="error" />
            <Typography variant="h6" fontWeight="bold">Noticias y Normativas DNIT</Typography>
          </Box>
          <Grid container spacing={5} justifyContent="center" sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, sm: 4 }} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                <Chip icon={<UpdateIcon />} label={lastNewsUpdate || '—'} size="small" variant="outlined" sx={{ fontWeight: 500 }} />
                <Button variant="contained" size="small" disabled={scrapingNews} onClick={handleScrapeNoticias} sx={floatingBtnStyle}>
                  {scrapingNews ? <CircularProgress size={18} color="inherit" /> : 'Traer noticias'}
                </Button>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                Noticias institucionales. Se muestran en la barra superior.
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', ml: { sm: 12 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                <Chip icon={<UpdateIcon />} label={lastNormUpdate || '—'} size="small" variant="outlined" sx={{ fontWeight: 500 }} />
                <Button variant="contained" size="small" color="secondary" disabled={scrapingNorm} onClick={handleScrapeNormativas} sx={floatingBtnStyle}>
                  {scrapingNorm ? <CircularProgress size={18} color="inherit" /> : 'Traer normativas'}
                </Button>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                Enlaces a normativas. Se muestran en la barra superior.
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* FERIADOS */}
      <Card sx={{ mt: 3, p: 2, borderRadius: 3, ...cardStyle }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <CalendarMonthIcon color="primary" />
            <Typography variant="h6" fontWeight="bold">Feriados (Calendario Perpetuo)</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            Feriados considerados para el cálculo de vencimientos del mes actual según terminación de RUC.
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="contained" size="small" sx={floatingBtnStyle} onClick={handleGenerarFeriados} disabled={generandoFeriados}>
              {generandoFeriados ? <CircularProgress size={18} color="inherit" /> : `Generar feriados ${new Date().getFullYear()}`}
            </Button>
            <Button variant="outlined" size="small" sx={floatingBtnStyle} onClick={() => setFeriadoDialogOpen(true)}>
              Agregar feriado
            </Button>
          </Box>

          {feriados.length > 0 && (
            <TableContainer component={Paper} sx={{ maxHeight: 260, '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>Fecha</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>Descripción</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }} align="center">Acción</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {feriados.map(f => (
                    <TableRow key={f.id} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{f.fecha}</TableCell>
                      <TableCell>{f.descripcion}</TableCell>
                      <TableCell align="center">
                        <IconButton size="small" color="error" onClick={() => handleEliminarFeriado(f.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Dialog agregar feriado */}
      <Dialog open={feriadoDialogOpen} onClose={() => setFeriadoDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Agregar feriado</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Fecha"
              type="date"
              fullWidth
              size="small"
              value={nuevoFeriado.fecha}
              onChange={(e) => setNuevoFeriado(prev => ({ ...prev, fecha: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Descripción"
              fullWidth
              size="small"
              value={nuevoFeriado.descripcion}
              onChange={(e) => setNuevoFeriado(prev => ({ ...prev, descripcion: e.target.value }))}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFeriadoDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleAgregarFeriado} disabled={!nuevoFeriado.fecha || !nuevoFeriado.descripcion}>Guardar</Button>
        </DialogActions>
      </Dialog>

      {/* MANTENIMIENTO DE BASE DE DATOS */}
      <Card sx={{ mt: 3, p: 2, borderRadius: 3, ...cardStyle }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
            <BuildCircleIcon color="warning" />
            <Typography variant="h6" fontWeight="bold">Mantenimiento de Base de Datos</Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Button variant="outlined" size="small" startIcon={<StorageIcon />} onClick={() => navigate('/admin/data')}>
              Ver Datos BD
            </Button>
          </Box>
          {dbStats && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ flex: '1 1 200px' }}>
                <Typography variant="caption" color="text.secondary">Tamaño total</Typography>
                <Typography variant="body2" fontWeight="bold">{dbStats.size?.total_size || '—'}</Typography>
              </Box>
              <Box sx={{ flex: '1 1 200px' }}>
                <Typography variant="caption" color="text.secondary">Datos / Índices</Typography>
                <Typography variant="body2" fontWeight="bold">{dbStats.size?.table_size || '—'} / {dbStats.size?.index_size || '—'}</Typography>
              </Box>
              <Box sx={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Registros</Typography>
                  <Typography variant="body2" fontWeight="bold">{Number(dbStats.total).toLocaleString('es-PY')}</Typography>
                </Box>
                <Tooltip title="Actualizar">
                  <IconButton size="small" color="primary" onClick={fetchDbStats}>
                    <UpdateIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Box sx={{ flex: '1 1 200px' }}>
                <Typography variant="caption" color="text.secondary">Filas muertas</Typography>
                <Typography variant="body2" fontWeight="bold">{dbStats.stats?.n_dead_tup ?? '—'}</Typography>
              </Box>
            </Box>
          )}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Tooltip title="Limpia espacio muerto y actualiza estadísticas. Recomendado tras muchas eliminaciones." arrow>
              <Button
                variant="outlined" color="warning" size="small"
                sx={floatingBtnStyle}
                disabled={dbMaintenance.loading}
                onClick={() => handleDbMaintenance('vacuum')}
                startIcon={dbMaintenance.loading && dbMaintenance.action === 'vacuum' ? <CircularProgress size={16} /> : <SpeedIcon />}
              >
                Optimizar
              </Button>
            </Tooltip>
            <Tooltip title="Reconstruye los índices para mejorar velocidad de búsquedas. Recomendado si las búsquedas están lentas." arrow>
              <Button
                variant="outlined" color="warning" size="small"
                sx={floatingBtnStyle}
                disabled={dbMaintenance.loading}
                onClick={() => handleDbMaintenance('reindex')}
                startIcon={dbMaintenance.loading && dbMaintenance.action === 'reindex' ? <CircularProgress size={16} /> : <CleaningServicesIcon />}
              >
                Reindexar
              </Button>
            </Tooltip>
            <Tooltip title="Actualiza estadísticas de la tabla para que el planner de consultas funcione mejor." arrow>
              <Button
                variant="outlined" color="warning" size="small"
                sx={floatingBtnStyle}
                disabled={dbMaintenance.loading}
                onClick={() => handleDbMaintenance('analyze')}
                startIcon={dbMaintenance.loading && dbMaintenance.action === 'analyze' ? <CircularProgress size={16} /> : <StorageIcon />}
              >
                Analizar
              </Button>
            </Tooltip>
<Box sx={{ flexGrow: 1 }} />
            </Box>
          {(() => {
            if (!dbStats?.stats || !dbStats?.vacuum) return null;
            const total = Number(dbStats.total || 0);
            const dead = Number(dbStats.stats.n_dead_tup ?? 0);

            const toDays = (d) => {
              if (!d) return null;
              const dt = new Date(d);
              if (Number.isNaN(dt.getTime())) return null;
              return (Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24);
            };

            const daysSinceAnalyze = toDays(dbStats.vacuum.last_analyze || dbStats.vacuum.last_autoanalyze);

            const deadRatio = total > 0 ? dead / total : 0;

            // Umbrales: Opción B (porcentaje). Según tu respuesta: “b”.
            const needsVacuum = deadRatio > 0.05;
            // “Analizar” recomendado solo por antigüedad del último ANALIZAR.
            const needsAnalyze = daysSinceAnalyze != null ? daysSinceAnalyze > 7 : false;
            const needsReindex = deadRatio > 0.15;

            return (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Recomendaciones (basadas en % de filas muertas y antigüedad de ANALIZAR)

                </Typography>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    label={needsVacuum ? `Optimizar recomendado` : `Optimizar: OK`}
                    size="small"
                    color={needsVacuum ? 'warning' : 'success'}
                    variant={needsVacuum ? 'filled' : 'outlined'}
                  />
                  <Chip
                    label={needsAnalyze ? `Analizar recomendado` : `Análisis: OK`}
                    size="small"
                    color={needsAnalyze ? 'warning' : 'success'}
                    variant={needsAnalyze ? 'filled' : 'outlined'}
                  />
                  <Chip
                    label={needsReindex ? `Reindexar sugerido` : `Reindexar: OK`}
                    size="small"
                    color={needsReindex ? 'error' : 'success'}
                    variant={needsReindex ? 'outlined' : 'outlined'}
                  />
                </Box>
                <Typography variant="body2" sx={{ mt: 0.5 }} color="text.secondary">
                  Filas muertas: <b>{dead.toLocaleString('es-PY')}</b> (ratio: {(deadRatio * 100).toFixed(2)}%) • Último Análisis: <b>{dbStats.vacuum.last_analyze ? new Date(dbStats.vacuum.last_analyze).toLocaleDateString('es-PY') : '—'}</b>

                </Typography>
              </Box>
            );
          })()}

          {dbStats?.indexes && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Índices:</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {dbStats.indexes.map(idx => (
                  <Chip
                    key={idx.indexname}
                    label={`${idx.indexname} (${idx.size})`}
                    size="small"
                    variant="outlined"
                    color="default"
                    sx={{ fontSize: '0.7rem' }}
                  />
                ))}
              </Box>
            </Box>
          )}

        </CardContent>
      </Card>

      {/* MENSAJES DE ESTADO */}
      <Box sx={{ mt: 4 }}>
        {loading && <Alert severity="info" sx={{ borderRadius: 2, boxShadow: 1 }}>Procesando en segundo plano... esto puede demorar varios minutos. Por favor, no cierre esta ventana.</Alert>}
      </Box>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity={snackbarInfo.severity}
          variant="filled"
          sx={{ boxShadow: 3, minWidth: 300 }}
          onClose={() => setSnackbarOpen(false)}
        >
          {snackbarInfo.message}
        </Alert>
      </Snackbar>

      {/* MODAL DE PROGRESO - COMPARACIÓN */}
      <Dialog open={compareProgress.open} disableEscapeKeyDown>
        <DialogTitle sx={{ textAlign: 'center', fontWeight: 'bold', color: 'primary.main', minWidth: { xs: 'auto', sm: 380 } }}>
          Comparando archivos
        </DialogTitle>
        <DialogContent sx={{ py: 3, px: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <CompareArrowsIcon color="info" />
            <Typography variant="body2" fontWeight="medium" color="text.secondary">
              {compareProgress.text || 'Procesando...'}
            </Typography>
          </Box>
          <Box sx={{ width: '100%', mt: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">Progreso</Typography>
              <Typography variant="caption" fontWeight="bold" color="primary.main">{Math.round(compareProgress.value)}%</Typography>
            </Box>
            <LinearProgress variant={compareProgress.value === 100 ? 'determinate' : 'indeterminate'} value={compareProgress.value} sx={{ height: 8, borderRadius: 4 }} />
          </Box>
        </DialogContent>
      </Dialog>

      {/* MODAL DE PROGRESO - SINCRONIZACIÓN */}
      <Dialog open={progressModal.open} disableEscapeKeyDown>
        <DialogTitle sx={{ textAlign: 'center', fontWeight: 'bold', color: 'primary.main', minWidth: { xs: 'auto', sm: 380 } }}>
          Sincronizando Base de Datos
        </DialogTitle>
        <DialogContent sx={{ py: 3, px: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            {progressModal.icon && (
              <Box sx={{ color: 'primary.main', display: 'flex' }}>
                {progressModal.icon}
              </Box>
            )}
            <Typography variant="body2" fontWeight="medium" color="text.secondary">
              {progressModal.text}
            </Typography>
          </Box>
          <Box sx={{ width: '100%', mt: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">Progreso</Typography>
              <Typography variant="caption" fontWeight="bold" color="primary.main">{Math.round(progressModal.value)}%</Typography>
            </Box>
            <LinearProgress variant="determinate" value={progressModal.value} sx={{ height: 8, borderRadius: 4 }} />
          </Box>
          {progressModal.value < 100 && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button variant="text" color="error" size="small" onClick={handleCancelProcess} disabled={cancelling}>
                {cancelling ? 'Cancelando...' : 'Cancelar'}
              </Button>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      </Container>
    </>
  );
}