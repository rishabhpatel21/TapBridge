import { useCallback, useEffect, useRef, useState } from 'react';
import { ClientMessage, ServerMessage } from '../types/ws';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

type Options = {
  onMessage?: (message: ServerMessage) => void;
  pingIntervalMs?: number;
};

export const useWebSocketClient = ({ onMessage, pingIntervalMs = 10000 }: Options = {}) => {
  const wsRef = useRef<WebSocket | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentUrlRef = useRef<string | null>(null);
  const onMessageRef = useRef<Options['onMessage']>(onMessage);
  const statusRef = useRef<ConnectionStatus>('disconnected');

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastError, setLastError] = useState<string | undefined>(undefined);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const cleanup = useCallback(() => {
    if (pingTimer.current) {
      clearInterval(pingTimer.current);
      pingTimer.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    currentUrlRef.current = null;
  }, []);

  const connect = useCallback(
    (ip: string, port: number) => {
      if (!ip) return;
      const url = `ws://${ip}:${port}`;
      const existing = wsRef.current;
      if (
        existing &&
        (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING) &&
        currentUrlRef.current === url &&
        statusRef.current !== 'error'
      ) {
        return;
      }
      cleanup();
      setStatus('connecting');
      setLastError(undefined);

      const ws = new WebSocket(url);
      wsRef.current = ws;
      currentUrlRef.current = url;

      ws.onopen = () => {
        if (ws !== wsRef.current) return;
        setStatus('connected');
        pingTimer.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' } satisfies ClientMessage));
          }
        }, pingIntervalMs);
      };

      ws.onmessage = (event) => {
        if (ws !== wsRef.current) return;
        try {
          const message = JSON.parse(String(event.data)) as ServerMessage;
          if (message.type === 'error') {
            setLastError(message.payload.message);
          }
          onMessageRef.current?.(message);
        } catch (error) {
          setLastError('Malformed server message');
        }
      };

      ws.onerror = () => {
        if (ws !== wsRef.current) return;
        setLastError('Unable to reach server');
        if (ws.readyState !== WebSocket.OPEN) {
          setStatus('error');
        }
      };

      ws.onclose = () => {
        if (ws !== wsRef.current) return;
        setStatus('disconnected');
        if (pingTimer.current) {
          clearInterval(pingTimer.current);
          pingTimer.current = null;
        }
        wsRef.current = null;
        currentUrlRef.current = null;
      };
    },
    [cleanup, pingIntervalMs]
  );

  const disconnect = useCallback(() => {
    cleanup();
    setStatus('disconnected');
  }, [cleanup]);

  const send = useCallback((message: ClientMessage) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setLastError('Not connected');
      return false;
    }
    ws.send(JSON.stringify(message));
    return true;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  return {
    status,
    lastError,
    connect,
    disconnect,
    send
  };
};
