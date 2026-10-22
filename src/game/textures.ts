import * as THREE from 'three';
import { HullLiveryType } from './types';

export interface LiveryPalette {
  primaryHex: string;
  secondaryHex: string;
  trimHex: string;
  stripeHex: string;
  metalness: number;
  roughness: number;
}

export const LIVERY_PALETTES: Record<HullLiveryType, LiveryPalette> = {
  spacenet_cyan: {
    primaryHex: '#F1F5F9',
    secondaryHex: '#0F172A',
    trimHex: '#1488B8',
    stripeHex: '#38BDF8',
    metalness: 0.35,
    roughness: 0.4,
  },
  retro_arcade: {
    primaryHex: '#F8FAFC',
    secondaryHex: '#DC2626',
    trimHex: '#F59E0B',
    stripeHex: '#EF4444',
    metalness: 0.25,
    roughness: 0.48,
  },
  solar_gold: {
    primaryHex: '#F59E0B',
    secondaryHex: '#1E293B',
    trimHex: '#FDE047',
    stripeHex: '#38BDF8',
    metalness: 0.78,
    roughness: 0.22,
  },
  stealth_obsidian: {
    primaryHex: '#1E293B',
    secondaryHex: '#090D16',
    trimHex: '#0EA5E9',
    stripeHex: '#22D3EE',
    metalness: 0.62,
    roughness: 0.32,
  },
};

/**
 * Generates a crisp retro-pixelated hull texture with pixel rivets, checker bands, and SpaceNet striping.
 * Uses NearestFilter for authentic pixel-art fidelity while setting SRGBColorSpace and max anisotropy.
 */
export function createPixelHullTexture(
  livery: HullLiveryType,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const palette = LIVERY_PALETTES[livery];
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  // Base hull fill
  ctx.fillStyle = palette.primaryHex;
  ctx.fillRect(0, 0, 64, 64);

  // Retro pixel panel seams
  ctx.fillStyle = palette.secondaryHex;
  ctx.fillRect(0, 0, 64, 6);
  ctx.fillRect(0, 56, 64, 8);

  // SpaceNet / Retro pixel checkerboard band
  for (let x = 0; x < 64; x += 4) {
    ctx.fillStyle = (x / 4) % 2 === 0 ? palette.trimHex : palette.secondaryHex;
    ctx.fillRect(x, 12, 4, 4);
    ctx.fillStyle = (x / 4) % 2 === 1 ? palette.trimHex : palette.primaryHex;
    ctx.fillRect(x, 16, 4, 4);
  }

  // Vertical SpaceNet accent stripe
  ctx.fillStyle = palette.trimHex;
  ctx.fillRect(28, 22, 8, 30);
  ctx.fillStyle = palette.stripeHex;
  ctx.fillRect(30, 22, 4, 30);

  // Pixel rivets along seams
  ctx.fillStyle = '#94A3B8';
  for (let x = 2; x < 64; x += 8) {
    ctx.fillRect(x, 8, 2, 2);
    ctx.fillRect(x, 52, 2, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Generates a linear-space micro-relief pixel bump map for metallic panel seams and craters.
 */
export function createPixelPanelBumpTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 64, 64);

  // Recessed grid lines
  ctx.fillStyle = '#383838';
  for (let i = 0; i < 64; i += 16) {
    ctx.fillRect(0, i, 64, 2);
    ctx.fillRect(i, 0, 2, 64);
  }

  // Raised pixel rivets
  ctx.fillStyle = '#E0E0E0';
  for (let y = 4; y < 64; y += 16) {
    for (let x = 4; x < 64; x += 16) {
      ctx.fillRect(x, y, 2, 2);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Generates a crisp pixel-art launchpad deck texture with hazard chevrons and SpaceNet target crosshairs.
 */
export function createPixelPadTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1E293B';
  ctx.fillRect(0, 0, 64, 64);

  // Hazard border stripes
  for (let i = 0; i < 64; i += 8) {
    ctx.fillStyle = (i / 8) % 2 === 0 ? '#F59E0B' : '#0F172A';
    ctx.fillRect(i, 0, 8, 6);
    ctx.fillRect(i, 58, 8, 6);
    ctx.fillRect(0, i, 6, 8);
    ctx.fillRect(58, i, 6, 8);
  }

  // Inner SpaceNet Cyan pad ring
  ctx.fillStyle = '#1488B8';
  ctx.fillRect(16, 16, 32, 32);
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(20, 20, 24, 24);

  // Center pixel H / Target cross
  ctx.fillStyle = '#38BDF8';
  ctx.fillRect(30, 24, 4, 16);
  ctx.fillRect(24, 30, 16, 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Generates a soft radial contact shadow texture for grounding vehicles and pads.
 */
export function createRadialShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(2, 6, 14, 0.85)');
  grad.addColorStop(0.55, 'rgba(2, 6, 14, 0.35)');
  grad.addColorStop(1, 'rgba(2, 6, 14, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
