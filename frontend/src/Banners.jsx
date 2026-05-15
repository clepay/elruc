import React, { useState, useEffect, useCallback } from 'react'
import { Box, Typography, Button } from '@mui/material'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import TwoWheelerIcon from '@mui/icons-material/TwoWheeler'
import motoraImg from './motora-mockup.webp'
import tekokuatiaImg from './tekokuatia-mockup.webp'

const slides = [
  {
    key: 'tekokuatia',
    img: tekokuatiaImg,
    icon: <ReceiptLongIcon sx={{ fontSize: 20 }} />,
    title: 'Tekokuatia',
    desc: 'Necesitas facturacion electronica?',
    features: ['Facturacion electronica DNIT', 'Gestion de comprobantes', 'Informes fiscales'],
    url: 'https://tekokuatia.com.py',
    color: '#0038a8'
  },
  {
    key: 'motora',
    img: motoraImg,
    icon: <TwoWheelerIcon sx={{ fontSize: 20 }} />,
    title: 'MotoraTPV',
    desc: 'Tenes una casa de venta de moto repuestos o lubricantes?',
    features: ['Control de stock', 'Gestion de ventas', 'Administracion de lubricantes'],
    url: 'https://motora.com.py',
    color: '#d52b1e'
  }
]

export default function Banners() {
  const [active, setActive] = useState(0)
  const next = useCallback(() => setActive(i => (i + 1) % slides.length), [])
  useEffect(() => { const t = setInterval(next, 6000); return () => clearInterval(t) }, [next])

  return (
    <Box sx={{ width: '100%', py: 3, position: 'relative', zIndex: 1 }}>
      <Box sx={{ maxWidth: 680, mx: 'auto', position: 'relative', height: { xs: 200, sm: 160 } }}>
        {slides.map((s, i) => (
          <Box
            key={s.key}
            sx={{
              position: 'absolute', inset: 0, display: 'flex',
              bgcolor: 'rgba(255,255,255,0.88)',
              backdropFilter: 'blur(16px)',
              borderRadius: 3, overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
              opacity: i === active ? 1 : 0,
              pointerEvents: i === active ? 'auto' : 'none',
              transition: 'opacity 0.6s ease',
            }}
          >
            <Box
              component="img"
              src={s.img}
              alt={s.title}
              sx={{ width: '25%', objectFit: 'cover', flexShrink: 0 }}
            />
            <Box sx={{ flexGrow: 1, p: { xs: 1.5, sm: 2.5 }, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: s.color }}>
                    {s.icon}
                    <Typography variant="subtitle1" fontWeight="bold" color={s.color}>{s.title}</Typography>
                  </Box>
                <Button
                  variant="outlined"
                  size="small"
                  endIcon={<OpenInNewIcon fontSize="small" />}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ minWidth: 100, borderColor: s.color, color: s.color, display: { xs: 'none', sm: 'inline-flex' } }}
                >
                  {s.title}
                </Button>
              </Box>
              <Typography variant="body2" fontWeight="500">{s.desc}</Typography>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 0.3 }}>
                {s.features.map(f => (
                    <Typography key={f} variant="caption" color="text.secondary">
                      <Box component="span" sx={{ color: '#d52b1e', mr: 0.3 }}>•</Box>{f}
                    </Typography>
                  ))}
              </Box>
              <Button
                variant="outlined"
                size="small"
                endIcon={<OpenInNewIcon fontSize="small" />}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ mt: 1, borderColor: s.color, color: s.color, display: { xs: 'inline-flex', sm: 'none' }, alignSelf: 'flex-start' }}
              >
                {s.title}
              </Button>
            </Box>
          </Box>
        ))}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 2 }}>
        {slides.map((_, i) => (
          <Box
            key={i}
            onClick={() => setActive(i)}
            sx={{
              width: i === active ? 24 : 8, height: 8, borderRadius: 4,
              bgcolor: i === active ? '#0038a8' : '#ccc',
              cursor: 'pointer', transition: 'all 0.3s ease'
            }}
          />
        ))}
      </Box>
    </Box>
  )
}
