
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- First user becomes admin, everyone else user
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count int;
BEGIN
  SELECT count(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_assign_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Items
CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  unit text NOT NULL DEFAULT 'pcs',
  quantity integer NOT NULL DEFAULT 0,
  low_stock_threshold integer NOT NULL DEFAULT 5,
  location text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO authenticated;
GRANT ALL ON public.items TO service_role;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view items" ON public.items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert items" ON public.items
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update items" ON public.items
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete items" ON public.items
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER items_set_updated_at BEFORE UPDATE ON public.items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Movements
CREATE TYPE public.movement_type AS ENUM ('issue', 'return', 'restock', 'adjustment');

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  movement_type public.movement_type NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  issued_to text,
  notes text,
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view movements" ON public.stock_movements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert movements" ON public.stock_movements
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger to update item quantity on movement
CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_qty int;
BEGIN
  SELECT quantity INTO current_qty FROM public.items WHERE id = NEW.item_id FOR UPDATE;
  IF current_qty IS NULL THEN RAISE EXCEPTION 'Item not found'; END IF;

  IF NEW.movement_type = 'issue' THEN
    IF current_qty < NEW.quantity THEN RAISE EXCEPTION 'Insufficient stock (have %, need %)', current_qty, NEW.quantity; END IF;
    UPDATE public.items SET quantity = quantity - NEW.quantity WHERE id = NEW.item_id;
  ELSIF NEW.movement_type IN ('return', 'restock') THEN
    UPDATE public.items SET quantity = quantity + NEW.quantity WHERE id = NEW.item_id;
  ELSIF NEW.movement_type = 'adjustment' THEN
    UPDATE public.items SET quantity = NEW.quantity WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER stock_movements_apply
AFTER INSERT ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();

-- Seed demo items
INSERT INTO public.items (name, category, unit, quantity, low_stock_threshold, location) VALUES
  ('Microscope Slides', 'Glassware', 'box', 42, 10, 'Cabinet A1'),
  ('Beaker 250ml', 'Glassware', 'pcs', 18, 8, 'Cabinet A2'),
  ('Bunsen Burner', 'Equipment', 'pcs', 6, 4, 'Shelf B1'),
  ('Test Tubes', 'Glassware', 'box', 3, 5, 'Cabinet A1'),
  ('Digital Thermometer', 'Instruments', 'pcs', 12, 3, 'Drawer C2'),
  ('Latex Gloves', 'Consumables', 'box', 2, 10, 'Storage D'),
  ('pH Indicator Paper', 'Consumables', 'roll', 25, 5, 'Drawer C1'),
  ('Petri Dishes', 'Glassware', 'pcs', 60, 20, 'Cabinet A3'),
  ('Safety Goggles', 'Safety', 'pcs', 15, 5, 'Rack S1'),
  ('Analytical Balance', 'Instruments', 'pcs', 1, 1, 'Bench 4');
