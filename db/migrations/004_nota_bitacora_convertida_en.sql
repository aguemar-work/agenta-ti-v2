ALTER TABLE nota_bitacora
ADD COLUMN IF NOT EXISTS convertida_en text
CHECK (convertida_en IN ('tarea', 'evento'))
DEFAULT NULL;
