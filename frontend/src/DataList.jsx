import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Container, Typography, Box, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination, Paper,
  IconButton, Tooltip, CircularProgress, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, InputAdornment, Alert
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import UpdateIcon from '@mui/icons-material/Update';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import StorageIcon from '@mui/icons-material/Storage';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';

const formatName = (name) => {
  if (!name) return '';
  const parts = name.split(', ');
  if (parts.length === 2 && parts[1]) {
    return `${parts[1]} ${parts[0]}`;
  }
  return name;
};

const getEstadoColor = (estado) => {
  if (!estado) return 'default';
  const e = estado.toUpperCase();
  if (e.includes('ACTIVO')) return 'success';
  if (e.includes('CANCELADO') || e.includes('BAJA')) return 'error';
  if (e.includes('SUSPENDIDO')) return 'warning';
  return 'default';
};

function CleanAlert({ message, onClose }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;
  return (
    <Box sx={{ mt: 2 }}>
      <Alert severity="success" onClose={onClose}>{message}</Alert>
    </Box>
  );
}

export default function DataList() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const searchTimer = useRef(null);

  const [editDialog, setEditDialog] = useState({ open: false, record: null });
  const [editForm, setEditForm] = useState({ razon_social: '', estado: '' });
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [cleanMsg, setCleanMsg] = useState('');
  const [cleanMsgKey, setCleanMsgKey] = useState(0);

  const fetchData = async (pageNum = 0, searchTerm = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: pageNum, limit: rowsPerPage });
      if (searchTerm) params.set('search', searchTerm);
      const res = await fetch(`/api/admin/data-list?${params}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setData(json.data || []);
        setTotal(json.total || 0);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(page, search);
  }, [page, rowsPerPage]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(0);
      fetchData(0, value);
    }, 300);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { credentials: 'include' });
    navigate('/admin/login');
  };

  const handleDelete = (ruc, razonSocial) => {
    setConfirmDialog({
      open: true,
      title: 'Eliminar registro',
      message: `¿Eliminar el registro de "${razonSocial}" (RUC: ${ruc})?`,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        try {
          const res = await fetch(`/api/admin/data-record/${ruc}`, {
            method: 'DELETE',
            credentials: 'include'
          });
          if (res.ok) fetchData(page);
        } catch (err) {
          console.error('Error deleting record:', err);
        }
      }
    });
  };

  const handleEdit = (record) => {
    setEditForm({ razon_social: record.razon_social, estado: record.estado || '' });
    setEditDialog({ open: true, record });
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/data-record/${editDialog.record.ruc}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        setEditDialog({ open: false, record: null });
        fetchData(page);
      }
    } catch (err) {
      console.error('Error updating record:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCleanData = () => {
    setConfirmDialog({
      open: true,
      title: 'Limpiar datos',
      message: '¿Corregir caracteres no válidos al inicio/final de los registros? (comillas, comas, signos $, puntos, etc.)',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        setCleaning(true);
        try {
          const res = await fetch('/api/admin/clean-data', {
            method: 'POST',
            credentials: 'include'
          });
          if (res.ok) {
            const json = await res.json();
            setCleanMsg(json.message);
            setCleanMsgKey(k => k + 1);
            fetchData(page);
          }
        } catch (err) {
          console.error('Error cleaning data:', err);
        } finally {
          setCleaning(false);
        }
      }
    });
  };

  const floatingBtnStyle = {
    borderRadius: 8,
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  };

  return (
    <>
      <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>
      <Container maxWidth="lg" sx={{ py: 2 }}>
      <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <StorageIcon color="primary" sx={{ fontSize: 32 }} />
          <Box sx={{ flex: 1, minWidth: 250 }}>
            <Typography variant="h5" color="primary" fontWeight="bold">
              Datos de Contribuyentes
            </Typography>
          <Typography variant="body2" color="text.secondary">
            Padrón nacional de contribuyentes — {total > 0 ? `${total.toLocaleString()} registro(s)` : 'cargando...'}
          </Typography>
          <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block', maxWidth: 500, lineHeight: 1.4 }}>
            Listado de contribuyentes extraídos de la DNIT. Podés buscar, editar o eliminar registros,
            y limpiar caracteres no válidos al inicio o final de los campos.
          </Typography>
        </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Limpiar comillas de registros">
            <Button
              variant="outlined"
              color="warning"
              size="small"
              sx={floatingBtnStyle}
              startIcon={cleaning ? <CircularProgress size={16} /> : <CleaningServicesIcon />}
              onClick={handleCleanData}
              disabled={cleaning}
            >
              {cleaning ? 'Limpiando...' : 'Limpiar Datos'}
            </Button>
          </Tooltip>
          <Tooltip title="Actualizar datos">
            <IconButton color="primary" onClick={() => fetchData(page)}>
              <UpdateIcon />
            </IconButton>
          </Tooltip>
          <Button variant="outlined" size="small" sx={floatingBtnStyle} startIcon={<ArrowBackIcon />} onClick={() => navigate('/admin/import')}>
            Volver al panel
          </Button>
        </Box>
        <TextField
          size="small"
          placeholder="Buscar por RUC o Razón Social..."
          value={search}
          onChange={handleSearchChange}
          sx={{ minWidth: 280, flex: 1, maxWidth: 500, mx: 'auto', mt: '25px' }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" color="action" /></InputAdornment>,
          }}
        />
      </Box>

      <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
        <TableContainer sx={{
          maxHeight: 'calc(100vh - 250px)',
          '&::-webkit-scrollbar': { display: 'none' },
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>#</TableCell>
                <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>RUC / DV</TableCell>
                <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>Razón Social / Nombre</TableCell>
                <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>Estado</TableCell>
                <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }} align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    No hay registros
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row, index) => (
                  <TableRow key={row.ruc} hover>
                    <TableCell>{(page * rowsPerPage) + index + 1}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{row.ruc}-{row.dv}</TableCell>
                    <TableCell>{formatName(row.razon_social)}</TableCell>
                    <TableCell>
                      <Chip label={row.estado || '—'} size="small" color={getEstadoColor(row.estado)} variant="outlined" />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Eliminar">
                        <IconButton size="small" color="error" onClick={() => handleDelete(row.ruc, row.razon_social)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Editar">
                        <IconButton size="small" color="primary" onClick={() => handleEdit(row)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={total}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Filas por página:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
        />
      </Paper>

      {/* Dialog Editar */}
      <Dialog open={editDialog.open} onClose={() => setEditDialog({ open: false, record: null })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Editar Registro
          <IconButton onClick={() => setEditDialog({ open: false, record: null })}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="RUC" value={editDialog.record?.ruc || ''} fullWidth size="small" InputProps={{ readOnly: true }} />
            <TextField
              label="Razón Social"
              value={editForm.razon_social}
              onChange={(e) => setEditForm({ ...editForm, razon_social: e.target.value })}
              fullWidth
            />
            <TextField
              label="Estado"
              value={editForm.estado}
              onChange={(e) => setEditForm({ ...editForm, estado: e.target.value })}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog({ open: false, record: null })}>Cancelar</Button>
          <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSaveEdit} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Confirmación */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>Cancelar</Button>
          <Button variant="contained" color="primary" onClick={confirmDialog.onConfirm}>Aceptar</Button>
        </DialogActions>
      </Dialog>

      {/* Mensaje de limpieza */}
      <CleanAlert key={cleanMsgKey} message={cleanMsg} onClose={() => setCleanMsg('')} />
    </Container>
    </>
  );
}