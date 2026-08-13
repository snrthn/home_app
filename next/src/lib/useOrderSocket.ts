'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

// 师傅端接单池实时推送：匹配后端 socket.io 网关（@WebSocketGateway({ path: '/ws' })）。
// 注意：后端是 socket.io 协议，必须用 socket.io-client，不能用原生 WebSocket，否则连不上 /ws。
// 事件：new-order（新订单入池，推给师傅端）/ order-update（订单状态变更，全端广播）。
export interface OrderSocketHandlers {
  onNewOrder?: (order: any) => void;
  onOrderUpdate?: (order: any) => void;
}

export function useOrderSocket(handlers: OrderSocketHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

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
    });

    socket.on('new-order', (order: any) => handlersRef.current.onNewOrder?.(order));
    socket.on('order-update', (order: any) => handlersRef.current.onOrderUpdate?.(order));

    return () => {
      socket.disconnect();
    };
  }, []);
}
