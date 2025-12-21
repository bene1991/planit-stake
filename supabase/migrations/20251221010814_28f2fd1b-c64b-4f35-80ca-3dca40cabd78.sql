-- Create table to store VAPID keys (one per installation)
CREATE TABLE public.vapid_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  public_key TEXT NOT NULL,
  private_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security but allow read access for authenticated users
ALTER TABLE public.vapid_keys ENABLE ROW LEVEL SECURITY;

-- Only allow reading the public key for authenticated users
CREATE POLICY "Authenticated users can view public key" 
ON public.vapid_keys 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Service role can do everything (for edge function)
CREATE POLICY "Service role has full access" 
ON public.vapid_keys 
FOR ALL
USING (auth.role() = 'service_role');