import * as Nakama from '@heroiclabs/nakama-js';

const GUEST_DEVICE_ID_KEY = 'rot-royale-guest-device-id';

const getGuestDeviceId = () => {
  const existingDeviceId = window.localStorage.getItem(GUEST_DEVICE_ID_KEY);
  if (existingDeviceId) return existingDeviceId;

  const deviceId = window.crypto?.randomUUID?.() || `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(GUEST_DEVICE_ID_KEY, deviceId);
  return deviceId;
};

export const createNakamaClient = () => {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const host = window.location.hostname;
  const useSsl = window.location.protocol === 'https:';
  const port = isLocalhost ? '7350' : (window.location.port || (useSsl ? '443' : '80'));
  return new Nakama.Client('defaultkey', host, port, useSsl);
};

export const createGuestSession = async () => {
  const client = createNakamaClient();
  const deviceId = getGuestDeviceId();
  const session = await client.authenticateDevice(deviceId, true, `Guest-${deviceId.slice(-6)}`);
  const useSsl = window.location.protocol === 'https:';
  const socket = client.createSocket(useSsl, false);
  await socket.connect(session);
  const account = await client.getAccount(session);

  return {
    client,
    session,
    socket,
    account,
    username: account.user.username,
    isGuest: true,
  };
};