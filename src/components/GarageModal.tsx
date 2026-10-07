import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { UserProfile } from '../types/game.js';
import { api } from '../lib/api.js';
import { Car3D } from '../game/CarModel.js';
import { soundManager } from '../game/SoundManager.js';
import {
  X,
  Wrench,
  Coins,
  Gauge,
  Zap,
  Wind,
  ShieldAlert,
  Check,
  Lock,
  RotateCw,
  Sparkles,
  ShoppingBag
} from 'lucide-react';

interface GarageModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onProfileUpdated: (user: UserProfile) => void;
}

const CAR_COLORS = [
  { name: 'Flame Crimson', hex: '#ef4444' },
  { name: 'Neon Cyan', hex: '#06b6d4' },
  { name: 'Midnight Violet', hex: '#a855f7' },
  { name: 'Cyber Gold', hex: '#eab308' },
  { name: 'Emerald Drift', hex: '#10b981' },
  { name: 'Stealth Onyx', hex: '#1e293b' },
  { name: 'Electric Azure', hex: '#3b82f6' },
  { name: 'Hot Magenta', hex: '#ec4899' },
];

const UNDERGLOW_COLORS = [
  { name: 'Cyan Glow', hex: '#06b6d4' },
  { name: 'Purple Ray', hex: '#a855f7' },
  { name: 'Neon Green', hex: '#22c55e' },
  { name: 'Laser Red', hex: '#ef4444' },
  { name: 'Amber Blaze', hex: '#f59e0b' },
  { name: 'Deep Blue', hex: '#2563eb' },
];

const CAR_MODELS = [
  {
    id: 'Cyber GT',
    name: 'Cyber GT',
    desc: 'Balanced sports coupe with carbon splitter and twin spoiler. (Default starter vehicle)',
    price: 0,
    topSpeedBadge: '130 km/h',
    accelBadge: 'High',
  },
  {
    id: 'Apex Phantom',
    name: 'Apex Phantom',
    desc: 'Widebody aerodynamic supercar with massive GT wing and roof air induction scoop.',
    price: 500,
    topSpeedBadge: '220 km/h',
    accelBadge: 'Superior',
  },
  {
    id: 'Hyperion Supercar',
    name: 'Hyperion Supercar',
    desc: 'Streamlined exotic hypercar with bubble canopy, dorsal fin, and quad exhaust pipes.',
    price: 1000,
    topSpeedBadge: '260 km/h',
    accelBadge: 'Extreme',
  },
  {
    id: 'Velocity Formula',
    name: 'Velocity Formula',
    desc: 'Ultra-lightweight formula prototype with needle nose, multi-tier winglets and halo.',
    price: 2000,
    topSpeedBadge: '300 km/h',
    accelBadge: 'Supersonic',
  },
];

export const GarageModal: React.FC<GarageModalProps> = ({
  isOpen,
  onClose,
  user,
  onProfileUpdated,
}) => {
  const [selectedPreviewModel, setSelectedPreviewModel] = useState<string>(user?.carModel || 'Cyber GT');
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [buyingCar, setBuyingCar] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Secret Cheat Code State (Click '+' 10 times to unlock 10,000 coins)
  const [cheatClicks, setCheatClicks] = useState(0);
  const [cheatToast, setCheatToast] = useState<string | null>(null);
  const cheatTimerRef = useRef<any>(null);

  const handlePlusCheatClick = async () => {
    if (cheatTimerRef.current) clearTimeout(cheatTimerRef.current);
    const nextCount = cheatClicks + 1;
    setCheatClicks(nextCount);

    cheatTimerRef.current = setTimeout(() => {
      setCheatClicks(0);
    }, 3000);

    if (nextCount >= 10) {
      setCheatClicks(0);
      try {
        const res = await api.claimCheatCoins();
        onProfileUpdated(res.user);
        soundManager.playVictory();
        setCheatToast('🎉 CHEAT ACTIVATED! +10,000 COINS!');
        setTimeout(() => setCheatToast(null), 3500);
      } catch (err: any) {
        setCheatToast(err.message || 'Cheat failed');
        setTimeout(() => setCheatToast(null), 3000);
      }
    }
  };

  // 3D Preview Canvas references
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const carMeshRef = useRef<Car3D | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const previousMouseXRef = useRef(0);

  useEffect(() => {
    if (user?.carModel) {
      setSelectedPreviewModel(user.carModel);
    }
  }, [user?.carModel]);

  // Set up 3D Preview Scene
  useEffect(() => {
    if (!isOpen || !previewContainerRef.current) return;

    const container = previewContainerRef.current;
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 240;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060913);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 2.5, 6.8);
    camera.lookAt(0, 0.5, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Showroom Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0x38bdf8, 2.5);
    keyLight.position.set(5, 8, 5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xf43f5e, 1.5);
    rimLight.position.set(-5, 6, -5);
    scene.add(rimLight);

    // Showroom Turntable Platform
    const platformGeo = new THREE.CylinderGeometry(3.8, 4.0, 0.2, 40);
    const platformMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.8,
      roughness: 0.2,
    });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.y = -0.1;
    scene.add(platform);

    // Platform Neon Ring
    const ringGeo = new THREE.RingGeometry(3.7, 3.85, 40);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);

    // Turntable animation loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      if (carMeshRef.current && !isDraggingRef.current) {
        carMeshRef.current.group.rotation.y += 0.008;
      }
      renderer.render(scene, camera);
    };
    animate();

    // Mouse drag rotation controls
    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      previousMouseXRef.current = e.clientX;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current && carMeshRef.current) {
        const delta = e.clientX - previousMouseXRef.current;
        carMeshRef.current.group.rotation.y += delta * 0.015;
        previousMouseXRef.current = e.clientX;
      }
    };
    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      renderer.dispose();
    };
  }, [isOpen]);

  // Update 3D car in preview when model/color/underglow changes
  useEffect(() => {
    if (!sceneRef.current || !isOpen) return;

    if (carMeshRef.current) {
      sceneRef.current.remove(carMeshRef.current.group);
      carMeshRef.current = null;
    }

    const car = new Car3D({
      color: user?.carColor || '#ef4444',
      underglowColor: user?.underglowColor || '#06b6d4',
      modelName: selectedPreviewModel,
    });
    car.group.position.set(0, 0, 0);
    car.group.rotation.y = Math.PI / 4;
    sceneRef.current.add(car.group);
    carMeshRef.current = car;
  }, [selectedPreviewModel, user?.carColor, user?.underglowColor, isOpen]);

  if (!isOpen || !user) return null;

  const unlockedCars = user.unlockedCars || ['Cyber GT'];

  const handleColorSelect = async (hex: string) => {
    try {
      const updated = await api.updateProfile({ carColor: hex });
      onProfileUpdated(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to update color');
    }
  };

  const handleUnderglowSelect = async (hex: string) => {
    try {
      const updated = await api.updateProfile({ underglowColor: hex });
      onProfileUpdated(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to update underglow');
    }
  };

  const handleSelectEquipModel = async (modelId: string) => {
    setError(null);
    setSelectedPreviewModel(modelId);
    if (!unlockedCars.includes(modelId)) {
      return; // Not owned yet, just preview
    }
    try {
      const updated = await api.updateProfile({ carModel: modelId });
      onProfileUpdated(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to equip car');
    }
  };

  const handleBuyCar = async (car: (typeof CAR_MODELS)[0]) => {
    setError(null);
    if (user.coins < car.price) {
      setError(`Not enough coins! You need ${car.price} coins. Earn more by racing!`);
      return;
    }
    setBuyingCar(car.id);
    try {
      const updated = await api.buyCar(car.id, car.price);
      onProfileUpdated(updated);
      setSelectedPreviewModel(car.id);
    } catch (err: any) {
      setError(err.message || 'Failed to purchase car');
    } finally {
      setBuyingCar(null);
    }
  };

  const handleUpgrade = async (stat: 'topSpeed' | 'acceleration' | 'handling' | 'nitroCapacity') => {
    setError(null);
    setUpgrading(stat);
    try {
      const res = await api.upgradeStat(stat);
      onProfileUpdated(res.user);
    } catch (err: any) {
      setError(err.message || 'Upgrade failed');
    } finally {
      setUpgrading(null);
    }
  };

  const getUpgradeCost = (currentLvl: number) => currentLvl * 150;

  const previewCarInfo = CAR_MODELS.find((m) => m.id === selectedPreviewModel) || CAR_MODELS[0];
  const isPreviewCarOwned = unlockedCars.includes(previewCarInfo.id);
  const isPreviewCarEquipped = user.carModel === previewCarInfo.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-cyan-500/30 rounded-2xl p-5 sm:p-7 shadow-[0_0_40px_rgba(6,182,212,0.2)] my-6 max-h-[92vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors z-20"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black italic text-white tracking-wide">
                CUSTOM RACING GARAGE
              </h2>
              <p className="text-xs text-slate-400">
                Inspect 3D vehicles, purchase chassis & tune performance
              </p>
            </div>
          </div>

          <div className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-sm">
            <Coins className="w-4 h-4 text-amber-400" />
            <span>{user.coins.toLocaleString()} Coins</span>
            <button
              type="button"
              onClick={handlePlusCheatClick}
              title="Add Coins (+)"
              className="w-5 h-5 rounded-md bg-amber-400/25 hover:bg-amber-400/50 active:scale-90 text-amber-200 hover:text-white flex items-center justify-center font-black text-xs leading-none transition-transform cursor-pointer ml-1"
            >
              +
            </button>
            {cheatToast && (
              <div className="absolute -bottom-8 right-0 whitespace-nowrap px-3 py-1 rounded-lg bg-amber-400 text-slate-950 font-black text-xs shadow-[0_0_20px_rgba(245,158,11,0.9)] z-50 animate-bounce">
                {cheatToast}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 my-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs shrink-0">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-6 mt-4">
          {/* 3D INTERACTIVE CAR PREVIEW SHOWROOM */}
          <div className="relative rounded-2xl bg-gradient-to-b from-slate-950 to-slate-900 border border-cyan-500/30 p-2 overflow-hidden shadow-inner">
            <div
              ref={previewContainerRef}
              className="w-full h-52 sm:h-64 rounded-xl cursor-grab active:cursor-grabbing flex items-center justify-center"
            />

            {/* Turntable Drag Hint Overlay */}
            <div className="absolute top-4 left-4 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] font-semibold text-slate-300 pointer-events-none">
              <RotateCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
              <span>Drag to rotate 360°</span>
            </div>

            {/* Currently Previewed Car Specs Bar */}
            <div className="absolute bottom-3 left-3 right-3 p-3 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black italic text-white">
                    {previewCarInfo.name}
                  </span>
                  {isPreviewCarEquipped ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/40">
                      EQUIPPED
                    </span>
                  ) : isPreviewCarOwned ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-500/40">
                      OWNED
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-500/40 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      LOCKED
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-3 mt-0.5">
                  <span>Top Speed: <strong className="text-slate-200">{previewCarInfo.topSpeedBadge}</strong></span>
                  <span>Acceleration: <strong className="text-cyan-400">{previewCarInfo.accelBadge}</strong></span>
                </div>
              </div>

              {/* Action Button: Equip or Buy */}
              <div>
                {isPreviewCarEquipped ? (
                  <button
                    disabled
                    className="px-4 py-2 bg-slate-800 text-emerald-400 font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-default"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>In Use</span>
                  </button>
                ) : isPreviewCarOwned ? (
                  <button
                    onClick={() => handleSelectEquipModel(previewCarInfo.id)}
                    className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg text-xs transition-all shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                  >
                    Equip Vehicle
                  </button>
                ) : (
                  <button
                    onClick={() => handleBuyCar(previewCarInfo)}
                    disabled={buyingCar === previewCarInfo.id || user.coins < previewCarInfo.price}
                    className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
                      user.coins >= previewCarInfo.price
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>
                      {buyingCar === previewCarInfo.id ? 'Unlocking...' : `Unlock for ${previewCarInfo.price} Coins`}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 4 VEHICLE CHASSIS SELECTION CARDS (1 FREE, 3 BUYABLE) */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Select & Purchase Chassis (1 Free • 3 Credit Unlock)
              </h3>
              <span className="text-[11px] text-slate-400">
                Owned: {unlockedCars.length}/4
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CAR_MODELS.map((m) => {
                const isOwned = unlockedCars.includes(m.id);
                const isEquipped = user.carModel === m.id;
                const isPreviewing = selectedPreviewModel === m.id;

                return (
                  <div
                    key={m.id}
                    onClick={() => handleSelectEquipModel(m.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isPreviewing
                        ? 'bg-cyan-950/60 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-white">{m.name}</span>
                          {isEquipped ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/40">
                              EQUIPPED
                            </span>
                          ) : isOwned ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                              OWNED
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-500/40 flex items-center gap-1">
                              <Coins className="w-2.5 h-2.5" />
                              {m.price}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-tight">{m.desc}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-800/80 text-[10px]">
                      <span className="text-slate-400">
                        Speed: <strong className="text-slate-200">{m.topSpeedBadge}</strong>
                      </span>
                      {isOwned ? (
                        <span className="text-cyan-400 font-bold">
                          {isEquipped ? 'Active' : 'Click to Equip'}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBuyCar(m);
                          }}
                          disabled={user.coins < m.price}
                          className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold border border-amber-500/40 transition-colors flex items-center gap-1"
                        >
                          <Lock className="w-2.5 h-2.5" />
                          <span>Buy ({m.price})</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Exterior Body Paint */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2.5">
              Exterior Body Paint
            </h3>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {CAR_COLORS.map((c) => {
                const isSelected = user.carColor.toLowerCase() === c.hex.toLowerCase();
                return (
                  <button
                    key={c.hex}
                    onClick={() => handleColorSelect(c.hex)}
                    title={c.name}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-white bg-slate-800 shadow-md scale-105'
                        : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-full shadow-inner border border-white/20"
                      style={{ backgroundColor: c.hex }}
                    />
                    <span className="text-[9px] text-slate-400 truncate max-w-full text-center">
                      {c.name.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Underglow Neon Kit */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2.5">
              Underglow Neon Ground Effect
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {UNDERGLOW_COLORS.map((u) => {
                const isSelected = user.underglowColor?.toLowerCase() === u.hex.toLowerCase();
                return (
                  <button
                    key={u.hex}
                    onClick={() => handleUnderglowSelect(u.hex)}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-950/40 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                        : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full shadow-[0_0_8px_currentColor]"
                      style={{ backgroundColor: u.hex, color: u.hex }}
                    />
                    <span className="text-[11px] font-semibold text-slate-300 truncate">
                      {u.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Performance Upgrades */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2.5">
              Performance Tuning & Upgrades
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <UpgradeCard
                title="Top Speed"
                desc="Increases maximum terminal velocity on straightaways"
                level={user.upgrades.topSpeed}
                icon={<Gauge className="w-4 h-4 text-rose-400" />}
                cost={getUpgradeCost(user.upgrades.topSpeed)}
                userCoins={user.coins}
                loading={upgrading === 'topSpeed'}
                onUpgrade={() => handleUpgrade('topSpeed')}
              />

              <UpgradeCard
                title="Acceleration"
                desc="Improves 0-100 launch speed and post-crash recovery"
                level={user.upgrades.acceleration}
                icon={<Zap className="w-4 h-4 text-amber-400" />}
                cost={getUpgradeCost(user.upgrades.acceleration)}
                userCoins={user.coins}
                loading={upgrading === 'acceleration'}
                onUpgrade={() => handleUpgrade('acceleration')}
              />

              <UpgradeCard
                title="Handling"
                desc="Sharpens lateral lane switching and obstacle dodge agility"
                level={user.upgrades.handling}
                icon={<Wind className="w-4 h-4 text-cyan-400" />}
                cost={getUpgradeCost(user.upgrades.handling)}
                userCoins={user.coins}
                loading={upgrading === 'handling'}
                onUpgrade={() => handleUpgrade('handling')}
              />

              <UpgradeCard
                title="Nitro Capacity"
                desc="Extends nitrous oxide duration and supercharge velocity"
                level={user.upgrades.nitroCapacity}
                icon={<Coins className="w-4 h-4 text-blue-400" />}
                cost={getUpgradeCost(user.upgrades.nitroCapacity)}
                userCoins={user.coins}
                loading={upgrading === 'nitroCapacity'}
                onUpgrade={() => handleUpgrade('nitroCapacity')}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface UpgradeCardProps {
  title: string;
  desc: string;
  level: number;
  icon: React.ReactNode;
  cost: number;
  userCoins: number;
  loading: boolean;
  onUpgrade: () => void;
}

const UpgradeCard: React.FC<UpgradeCardProps> = ({
  title,
  desc,
  level,
  icon,
  cost,
  userCoins,
  loading,
  onUpgrade,
}) => {
  const isMax = level >= 5;
  const canAfford = userCoins >= cost;

  return (
    <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            {icon}
            <span className="text-xs font-bold text-white">{title}</span>
          </div>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
            {isMax ? 'MAX' : `LVL ${level}/5`}
          </span>
        </div>
        <p className="text-[10px] text-slate-400 mb-2 leading-tight">{desc}</p>

        <div className="flex gap-1 mb-3">
          {[1, 2, 3, 4, 5].map((lvl) => (
            <div
              key={lvl}
              className={`h-1.5 flex-1 rounded-full ${
                lvl <= level ? 'bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.6)]' : 'bg-slate-800'
              }`}
            />
          ))}
        </div>
      </div>

      <div>
        {isMax ? (
          <div className="w-full py-1.5 text-center text-[11px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 rounded-lg">
            Fully Upgraded
          </div>
        ) : (
          <button
            onClick={onUpgrade}
            disabled={!canAfford || loading}
            className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-between transition-all ${
              canAfford
                ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <span>{loading ? 'Upgrading...' : 'Upgrade'}</span>
            <div className="flex items-center gap-1 text-amber-300 text-[11px]">
              <Coins className="w-3 h-3 text-amber-400" />
              <span>{cost}</span>
            </div>
          </button>
        )}
      </div>
    </div>
  );
};
