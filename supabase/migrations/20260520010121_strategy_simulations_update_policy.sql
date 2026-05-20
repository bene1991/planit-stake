CREATE POLICY "Users can update their own simulations"
ON public.strategy_simulations FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
