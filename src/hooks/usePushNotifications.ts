import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);

  // Check if push notifications are supported
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);
  }, []);

  // Get or create VAPID keys on mount
  useEffect(() => {
    const getVapidKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('manage-vapid-keys', {
          body: { action: 'get-or-create' }
        });

        if (error) {
          console.error('Error getting VAPID key:', error);
          return;
        }

        if (data?.publicKey) {
          setVapidPublicKey(data.publicKey);
        }
      } catch (error) {
        console.error('Error fetching VAPID key:', error);
      }
    };

    getVapidKey();
  }, []);

  // Check current subscription status
  useEffect(() => {
    const checkSubscription = async () => {
      if (!isSupported || !user) return;

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch (error) {
        console.error('Error checking subscription:', error);
      }
    };

    checkSubscription();
  }, [isSupported, user]);

  // Convert base64 string to Uint8Array for applicationServerKey
  const urlBase64ToUint8Array = (base64String: string): ArrayBuffer => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray.buffer as ArrayBuffer;
  };

  const subscribe = useCallback(async () => {
    if (!isSupported || !user || !vapidPublicKey) {
      toast.error('Push notifications não estão disponíveis');
      return false;
    }

    setIsLoading(true);

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Permissão de notificação negada');
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      // Extract subscription details
      const subscriptionJson = subscription.toJSON();
      const endpoint = subscriptionJson.endpoint!;
      const p256dh = subscriptionJson.keys!.p256dh;
      const auth = subscriptionJson.keys!.auth;

      // Save subscription to database
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          owner_id: user.id,
          endpoint,
          p256dh,
          auth,
        }, {
          onConflict: 'owner_id,endpoint'
        });

      if (error) {
        console.error('Error saving subscription:', error);
        throw error;
      }

      setIsSubscribed(true);
      toast.success('Notificações push ativadas!');
      return true;

    } catch (error) {
      console.error('Error subscribing:', error);
      toast.error('Erro ao ativar notificações push');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, user, vapidPublicKey]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported || !user) return false;

    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Remove from database
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('owner_id', user.id)
          .eq('endpoint', subscription.endpoint);
      }

      setIsSubscribed(false);
      toast.success('Notificações push desativadas');
      return true;

    } catch (error) {
      console.error('Error unsubscribing:', error);
      toast.error('Erro ao desativar notificações push');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, user]);

  const sendTestNotification = useCallback(async () => {
    if (!user) return;

    try {
      const { error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: user.id,
          payload: {
            title: 'Teste de Notificação',
            body: 'Se você está vendo isso, as notificações push estão funcionando!',
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
          }
        }
      });

      if (error) {
        throw error;
      }

      toast.success('Notificação de teste enviada!');
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast.error('Erro ao enviar notificação de teste');
    }
  }, [user]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    sendTestNotification,
  };
};
