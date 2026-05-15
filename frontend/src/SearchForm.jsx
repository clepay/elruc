import React, { useState, useEffect, useCallback } from 'react';
import ReactGA from 'react-ga4';
import {
  TextField,
  IconButton,
  InputAdornment,
  Tooltip,
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CircularProgress from '@mui/material/CircularProgress';

const HISTORY_KEY = 'elruc_search_history';
const MAX_HISTORY = 10;

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistoryItem(query, razonSocial) {
  const history = loadHistory().filter(h => h.query !== query);
  history.unshift({ query, razonSocial, timestamp: Date.now() });
  if (history.length > MAX_HISTORY) history.pop();
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function displayName(name) {
  if (!name) return '';
  const parts = name.split(',');
  return parts.length === 2 ? `${parts[1].trim()} ${parts[0].trim()}` : name;
}

export default function SearchForm() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showEstado, setShowEstado] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [history, setHistory] = useState(loadHistory());
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuItem, setMenuItem] = useState(null);
  const [obligaciones, setObligaciones] = useState({});

  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        const mapped = data.map(item => ({ ruc: item.ruc, dv: item.dv, razonSocial: item.razon_social, estado: item.estado }));
        setResults(mapped);
        ReactGA.event({ category: 'Búsqueda', action: 'realizar_busqueda', label: query, value: data.length });
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    }, 80);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (results.length === 0) { setObligaciones({}); return; }
    const rucs = results.map(item => `${item.ruc}-${item.dv || '0'}`);
    fetch('/api/obligaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rucs })
    }).then(r => r.json()).then(list => {
      if (Array.isArray(list)) {
        const map = {};
        list.forEach(item => { map[item.ruc] = item; });
        setObligaciones(map);
      }
    }).catch(() => {});
  }, [results]);

  const saveToHistory = useCallback((q, razonSocial) => {
    const existing = loadHistory().filter(h => h.query !== q);
    existing.unshift({ query: q, razonSocial, timestamp: Date.now() });
    if (existing.length > MAX_HISTORY) existing.pop();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(existing));
    setHistory(existing);
  }, []);

  const handleCopy = useCallback((ruc, index) => {
    if (query.length >= 3) {
      saveToHistory(query, results[0]?.razonSocial || '');
    }
    navigator.clipboard.writeText(ruc).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }).catch(err => console.error('Error al copiar:', err));
  }, [query, results, saveToHistory]);

  const handleHistoryClick = useCallback((q) => {
    setQuery(q);
  }, []);

  const clearQuery = useCallback(() => {
    setQuery('');
    setResults([]);
  }, []);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  }, []);

  const handleCopyVariant = useCallback((text, index) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }).catch(err => console.error('Error al copiar:', err));
    setMenuAnchor(null);
  }, []);

  const handleMenuOpen = useCallback((e, item) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setMenuItem(item);
  }, []);

  const handleMenuClose = useCallback((e) => {
    if (e) e.stopPropagation();
    setMenuAnchor(null);
    setMenuItem(null);
  }, []);

  return (
    <Box sx={{ width: '100%', maxWidth: 680, mx: 'auto' }}>
      <Box sx={{
        boxShadow: '0 8px 40px rgba(0,56,168,0.10)',
        borderRadius: 4,
        bgcolor: 'white',
        p: 0.5,
        mb: 2,
      }}>
        <TextField
          fullWidth
          value={query}
          onChange={(e) => setQuery(e.target.value.toUpperCase())}
          placeholder="Buscá por RUC o Razón Social"
          variant="outlined"
          color="primary"
          inputProps={{ style: { textTransform: 'uppercase' } }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3.5, bgcolor: 'transparent' } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start" sx={{ ml: 1.5 }}>
                <SearchIcon color="primary" sx={{ fontSize: 26 }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end" sx={{ mr: 1.5, gap: 0.5 }}>
                {query && !loading && (
                  <IconButton onClick={clearQuery} edge="end" sx={{ color: 'error.main', minWidth: 44, minHeight: 44 }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                )}
                {loading && <CircularProgress color="inherit" size={20} />}
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {history.length > 0 && !query && results.length === 0 && (
        <Box sx={{ mt: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Últimas búsquedas
            </Typography>
            <IconButton onClick={clearHistory} size="small" sx={{ color: 'error.main' }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {history.map((h) => (
              <Tooltip key={h.timestamp} title={displayName(h.razonSocial) || ''} placement="top">
                <Chip
                  label={h.query}
                  size="small"
                  variant="outlined"
                  onClick={() => handleHistoryClick(h.query)}
                  sx={{ fontWeight: 500, cursor: 'pointer', '&:hover': { borderColor: 'primary.main', color: 'primary.main' } }}
                />
              </Tooltip>
            ))}
          </Box>
        </Box>
      )}

      {results.length > 0 && (
        <Box sx={{ bgcolor: 'white', borderRadius: 3, p: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Chip
              label={`${results.length} resultado${results.length !== 1 ? 's' : ''} encontrado${results.length !== 1 ? 's' : ''}`}
              size="small"
              variant="outlined"
              color="success"
              sx={{ fontWeight: 500 }}
            />
            <Chip
              icon={showEstado ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
              label={showEstado ? 'Ocultar Estado' : 'Ver Estado'}
              variant="outlined"
              size="small"
              onClick={() => setShowEstado(!showEstado)}
              sx={{ fontWeight: 500, cursor: 'pointer' }}
            />
          </Box>

          {results.map((item, index) => (
            <Card
              key={item.ruc}
              sx={{
                mb: 1.5,
                borderRadius: 3,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: '1px solid #eaeaea',
                bgcolor: 'white',
                '&:hover': {
                  boxShadow: '0 4px 20px rgba(0,56,168,0.12)',
                  borderColor: 'primary.main',
                  transform: 'translateY(-1px)',
                },
              }}
              onClick={() => handleCopy(item.ruc, index)}
            >
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
                      <Typography variant="h6" component="div" color="primary" fontWeight={800} sx={{ letterSpacing: '-0.5px', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                        {item.ruc}-{item.dv || '0'}
                      </Typography>
                      {showEstado && (
                        <>
                          {item.estado && (
                            <Chip
                              label={item.estado}
                              size="small"
                              variant="outlined"
                              color={item.estado === 'ACTIVO' ? 'success' : item.estado === 'CANCELADO' ? 'error' : item.estado === 'SUSPENSION TEMPORAL' ? 'warning' : 'default'}
                              sx={{ height: 20, fontSize: { xs: '0.7rem', sm: '0.65rem' }, fontWeight: 500 }}
                            />
                          )}
                          {(() => {
                            const key = `${item.ruc}-${item.dv || '0'}`;
                            const obl = obligaciones[key];
                            return obl && (
                              <Chip
                                icon={<CalendarMonthIcon sx={{ fontSize: 14 }} />}
                                label={`Venc. IVA: ${obl.dia_semana} ${new Date(obl.fecha).getDate().toString().padStart(2, '0')}/${(new Date(obl.fecha).getMonth() + 1).toString().padStart(2, '0')}/${new Date(obl.fecha).getFullYear()}`}
                                size="small"
                                color="primary"
                                variant="outlined"
                                sx={{ height: 20, fontSize: { xs: '0.7rem', sm: '0.65rem' }, fontWeight: 500 }}
                              />
                            );
                          })()}
                        </>
                      )}
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                      {displayName(item.razonSocial)}
                    </Typography>
                  </Box>
                  <Tooltip title={copiedIndex === index ? 'Copiado' : 'Copiar'} placement="left">
                    <IconButton
                      color="success"
                      onClick={(e) => handleMenuOpen(e, { ...item, index })}
                      sx={{ mt: 0.5, minWidth: 44, minHeight: 44 }}
                    >
                      <ContentCopyIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        onClick={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        slotProps={{ paper: { sx: { borderRadius: 2, minWidth: { xs: 160, sm: 200 } } } }}
      >
        <MenuItem onClick={() => handleCopyVariant(`${menuItem?.ruc}-${menuItem?.dv || '0'}`, menuItem?.index)} dense sx={{ color: 'primary.main', '&:hover': { bgcolor: 'grey.400' } }}>
          <ListItemIcon><ContentCopyIcon fontSize="small" sx={{ color: 'primary.main' }} /></ListItemIcon>
          <ListItemText>Copiar RUC-DV</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleCopyVariant(displayName(menuItem?.razonSocial), menuItem?.index)} dense sx={{ color: 'primary.main', '&:hover': { bgcolor: 'grey.400' } }}>
          <ListItemIcon><ContentCopyIcon fontSize="small" sx={{ color: 'primary.main' }} /></ListItemIcon>
          <ListItemText>Copiar Nombre</ListItemText>
        </MenuItem>
      </Menu>

      {query.length >= 3 && !loading && results.length === 0 && (
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 2 }}>
          No se encontraron resultados para &quot;{query}&quot;
        </Typography>
      )}
    </Box>
  );
}
