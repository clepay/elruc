import React from 'react';
import { Box, Typography } from '@mui/material';
import { keyframes } from '@emotion/react';

const floatAndFade = keyframes`
  0% { opacity: 0; transform: translateY(20px); }
  10% { opacity: 0.35; transform: translateY(0px); }
  50% { opacity: 0.35; transform: translateY(0px); }
  60% { opacity: 0; transform: translateY(-20px); }
  100% { opacity: 0; transform: translateY(-20px); }
`;

const phrases = [
  { text: "Pasame na el RUC para tu factura.", top: '2%', left: '2%', delay: '-1s' },
  { text: "¿A nombre de quién? Edictame un poco el RUC.", top: '8%', left: '52%', delay: '-4s' },
  { text: "Che, ¿tenés el RUC a mano?", top: '14%', left: '12%', delay: '-7s' },
  { text: "Moõpa oho la factura, ¿le ponemos el RUC?", top: '20%', left: '60%', delay: '-2s' },
  { text: "Para la factura legal, decime na el RUC.", top: '26%', left: '5%', delay: '-5s' },
  { text: "¿Le cargamos con el RUC o sin nombre nomás?", top: '32%', left: '48%', delay: '-8s' },
  { text: "Escribime un poco acá el RUC, chamigo.", top: '5%', left: '72%', delay: '-3s' },
  { text: "Aguantame un ratito que te dicto el RUC.", top: '17%', left: '30%', delay: '-6s' },
  { text: "Anotá na el RUC así ya te facturo.", top: '11%', left: '82%', delay: '-9s' },
  { text: "Heta oñeporandu en la caja", top: '23%', left: '75%', delay: '-1.5s' },
  { text: "A nombre de la empresa, ¿cuál era el RUC?", top: '29%', left: '18%', delay: '-4.5s' },
  { text: "¿Cuál es tu RUC?", top: '35%', left: '80%', delay: '-7.5s' },
  { text: "Decime el RUC para la factura", top: '38%', left: '5%', delay: '-2.5s' },
];

export default function AnimatedBackgroundPhrases() {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        zIndex: 0,
        userSelect: 'none',
        display: { xs: 'none', md: 'block' },
      }}
    >
      {phrases.map((item, index) => (
          <Box
          key={index}
          className="phrase-hitbox"
          sx={{
            position: 'absolute',
            top: item.top,
            left: item.left,
            pointerEvents: 'auto',
            '&:hover .phrase-text': {
              animationPlayState: 'paused',
            },
          }}
        >
          <Typography
            className="phrase-text"
            variant="body1"
            sx={{
              color: '#000000',
              fontWeight: 800,
              whiteSpace: 'nowrap',
              opacity: 0,
              textShadow: 'none',
              animation: `${floatAndFade} 10s infinite ease-in-out`,
              animationDelay: item.delay,
            }}
          >
            {item.text}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
