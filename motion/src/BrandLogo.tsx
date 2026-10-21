/**
 * ЗНАК БРЕНДА — фигура танцовщицы в прыжке.
 *
 * Геометрия 1:1 из утверждённого прототипа (`design/reference/artdance-final.html`,
 * блок `.nav-logo svg`). В проекте знак лежит растром в R2 (`brand/logo.png`),
 * но в ролике нужен вектор: он масштабируется до 900 px без потерь и красится
 * в любой цвет палитры.
 */

import React from 'react';

export const BrandMark: React.FC<{ size?: number; color?: string; opacity?: number }> = ({ size = 100, color = '#8B1A2B', opacity = 1 }) => (
  <svg viewBox="0 0 32 32" width={size} height={size} fill="none" style={{ opacity, display: 'block' }}>
    <circle cx="16" cy="6" r="3.2" fill={color} />
    <path
      d="M16 10.5C16 10.5 9 13.8 7.5 21C6 28 11.5 29.5 14.5 28C17.5 26.5 16 22.5 16 22.5C16 22.5 14.5 26.5 17.5 28C20.5 29.5 26 28 24.5 21C23 13.8 16 10.5 16 10.5Z"
      fill={color}
    />
    <path d="M11 15.5C11 15.5 8 12.5 5 14" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    <path d="M21 15.5C21 15.5 24 12.5 27 14" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
