'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getToken } from '@/lib/auth';

// 师傅端接单池实时推送：匹配后端 socket.io 网关（@WebSocketGateway({ path: '/ws' })）。
// 注意：后端是 socket.io 协议，必须用 socket.io-client，不能用原生 WebSocket，否则连不上 /ws。
// 事件：new-order（新订单入池，推给师傅端接单池）/ order-update（订单状态变更，按订阅 room 推送）。
//
// 鉴权：连接时携带当前角色 JWT（auth.token），网关在握手阶段校验，失败断开并触发 connect_error。
// 订阅：传入 { orderId } 自动订阅该订单详情 room；传入 { pool: true } 自动加入接单池（后端校验师傅角色）。
export interface OrderSocketHandlers {
  onNewOrder?: (order: any) => void;
  onOrderUpdate?: (order: any) => void;
  // 工作台刷新信号：后端在订单变化/师傅上线下线时推给 admin-dashboard room
  onDashboardRefresh?: () => void;
}

export interface OrderSocketOptions {
  orderId?: string;
  pool?: boolean;
}

export function useOrderSocket(
  handlers: OrderSocketHandlers,
  options?: OrderSocketOptions,
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const orderId = options?.orderId;
  const pool = options?.pool;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const base =
      process.env.NEXT_PUBLIC_API_BASE
        ? process.env.NEXT_PUBLIC_API_BASE.replace(/\/api$/, '')
        : `http://${window.location.hostname}:3721`;

    const socket: Socket = io(base, {
      path: '/ws',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      auth: { token: getToken() ?? undefined }, // 携带当前角色 JWT，供网关鉴权
    });

    socket.on('new-order', (order: any) => handlersRef.current.onNewOrder?.(order));
    socket.on('order-update', (order: any) => handlersRef.current.onOrderUpdate?.(order));
    socket.on('dashboard-refresh', () => handlersRef.current.onDashboardRefresh?.());
    socket.on('connect', () => console.log('[WS] connected:', socket.id));
    socket.on('connect_error', (err: any) => {
      console.log('[WS] connect_error:', err.message);
      if (err?.message === 'unauthorized') {
        // token 失效/被拉黑：提示重新登录（精细化自动刷新可后续补充）
        console.warn('[WS] 鉴权失败，请重新登录');
      }
    });

    // 进入即按选项订阅，离开时退订
    if (orderId) socket.emit('subscribe-order', orderId);
    if (pool) socket.emit('join-pool');

    return () => {
      if (orderId) socket.emit('unsubscribe-order', orderId);
      if (pool) socket.emit('leave-pool');
      socket.disconnect();
    };
  }, [orderId, pool]);
}
