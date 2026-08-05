-- =====================================================================
-- ENUMS
-- =====================================================================

CREATE TYPE rol_usuario AS ENUM ('comprador', 'proveedor', 'admin');
CREATE TYPE tipo_dato_atributo AS ENUM ('texto', 'lista');
CREATE TYPE estado_producto AS ENUM ('activo', 'pausado', 'agotado');
CREATE TYPE estado_pedido AS ENUM ('pendiente', 'pagado', 'enviado', 'entregado', 'cancelado');
CREATE TYPE estado_pago AS ENUM ('pendiente', 'aprobado', 'rechazado');
CREATE TYPE estado_liquidacion AS ENUM ('pendiente', 'pagada');

-- =====================================================================
-- 1. USUARIOS Y ACCESOS
-- =====================================================================

CREATE TABLE usuarios (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL,
    apellido        VARCHAR(100) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    telefono        VARCHAR(30),
    rol             rol_usuario NOT NULL DEFAULT 'comprador',
    fecha_registro  TIMESTAMP NOT NULL DEFAULT NOW(),
    activo          BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE proveedores (
    id                  SERIAL PRIMARY KEY,
    usuario_id          INT REFERENCES usuarios(id) ON DELETE SET NULL,
    nombre_comercial    VARCHAR(150) NOT NULL,
    es_dueño            BOOLEAN NOT NULL DEFAULT FALSE,
    comision_default    NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (comision_default >= 0 AND comision_default <= 100),
    datos_pago          VARCHAR(255),
    fecha_alta          TIMESTAMP NOT NULL DEFAULT NOW(),
    activo              BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE direcciones (
    id              SERIAL PRIMARY KEY,
    usuario_id      INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    calle           VARCHAR(150) NOT NULL,
    numero          VARCHAR(20),
    ciudad          VARCHAR(100) NOT NULL,
    provincia       VARCHAR(100) NOT NULL,
    cp              VARCHAR(20) NOT NULL,
    pais            VARCHAR(100) NOT NULL DEFAULT 'Argentina',
    predeterminada  BOOLEAN NOT NULL DEFAULT FALSE
);

-- =====================================================================
-- 2. CATÁLOGO
-- =====================================================================

CREATE TABLE categorias (
    id                  SERIAL PRIMARY KEY,
    nombre              VARCHAR(100) NOT NULL,
    slug                VARCHAR(100) NOT NULL UNIQUE,
    categoria_padre_id  INT REFERENCES categorias(id) ON DELETE SET NULL
);

CREATE TABLE atributos (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL,
    tipo_dato   tipo_dato_atributo NOT NULL DEFAULT 'texto'
);

CREATE TABLE categoria_atributos (
    id              SERIAL PRIMARY KEY,
    categoria_id    INT NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
    atributo_id     INT NOT NULL REFERENCES atributos(id) ON DELETE CASCADE,
    obligatorio     BOOLEAN NOT NULL DEFAULT FALSE,
    orden           INT NOT NULL DEFAULT 0,
    UNIQUE (categoria_id, atributo_id)
);

CREATE TABLE productos (
    id                      SERIAL PRIMARY KEY,
    proveedor_id            INT NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
    categoria_id            INT NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
    nombre                  VARCHAR(200) NOT NULL,
    descripcion             TEXT,
    precio_base             NUMERIC(12,2) NOT NULL CHECK (precio_base >= 0),
    comision_porcentaje     NUMERIC(5,2) CHECK (comision_porcentaje >= 0 AND comision_porcentaje <= 100),
    estado                  estado_producto NOT NULL DEFAULT 'activo',
    fecha_creacion          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE producto_imagenes (
    id              SERIAL PRIMARY KEY,
    producto_id     INT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    url             VARCHAR(500) NOT NULL,
    orden           INT NOT NULL DEFAULT 0
);

CREATE TABLE producto_variantes (
    id                  SERIAL PRIMARY KEY,
    producto_id         INT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    sku                 VARCHAR(50) NOT NULL UNIQUE,
    stock               INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    precio_ajustado     NUMERIC(12,2) CHECK (precio_ajustado >= 0),
    activo              BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE variante_atributo_valores (
    id              SERIAL PRIMARY KEY,
    variante_id     INT NOT NULL REFERENCES producto_variantes(id) ON DELETE CASCADE,
    atributo_id     INT NOT NULL REFERENCES atributos(id) ON DELETE CASCADE,
    valor           VARCHAR(150) NOT NULL,
    UNIQUE (variante_id, atributo_id)
);

-- =====================================================================
-- 3. VENTAS
-- =====================================================================

CREATE TABLE pedidos (
    id                  SERIAL PRIMARY KEY,
    usuario_id          INT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    direccion_envio_id  INT REFERENCES direcciones(id) ON DELETE SET NULL,
    fecha               TIMESTAMP NOT NULL DEFAULT NOW(),
    estado              estado_pedido NOT NULL DEFAULT 'pendiente',
    total               NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    metodo_pago         VARCHAR(50)
);

CREATE TABLE pedido_items (
    id                      SERIAL PRIMARY KEY,
    pedido_id               INT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    variante_id             INT NOT NULL REFERENCES producto_variantes(id) ON DELETE RESTRICT,
    proveedor_id            INT NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
    cantidad                INT NOT NULL CHECK (cantidad > 0),
    precio_unitario         NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),
    comision_porcentaje     NUMERIC(5,2) NOT NULL CHECK (comision_porcentaje >= 0 AND comision_porcentaje <= 100),
    comision_monto          NUMERIC(12,2) NOT NULL CHECK (comision_monto >= 0)
);

CREATE TABLE pagos (
    id                      SERIAL PRIMARY KEY,
    pedido_id               INT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    monto                   NUMERIC(12,2) NOT NULL CHECK (monto >= 0),
    metodo                  VARCHAR(50) NOT NULL,
    estado                  estado_pago NOT NULL DEFAULT 'pendiente',
    fecha                   TIMESTAMP NOT NULL DEFAULT NOW(),
    referencia_externa      VARCHAR(150)
);

CREATE TABLE envios (
    id                          SERIAL PRIMARY KEY,
    pedido_id                   INT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    transportista                VARCHAR(100),
    numero_seguimiento           VARCHAR(100),
    estado                      VARCHAR(50) NOT NULL DEFAULT 'pendiente',
    fecha_despacho               TIMESTAMP,
    fecha_entrega_estimada       TIMESTAMP
);

-- =====================================================================
-- 4. GESTIÓN DE PROVEEDORES
-- =====================================================================

CREATE TABLE liquidaciones (
    id                  SERIAL PRIMARY KEY,
    proveedor_id        INT NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
    periodo_desde       DATE NOT NULL,
    periodo_hasta       DATE NOT NULL,
    monto_bruto         NUMERIC(12,2) NOT NULL DEFAULT 0,
    monto_comision      NUMERIC(12,2) NOT NULL DEFAULT 0,
    monto_neto          NUMERIC(12,2) NOT NULL DEFAULT 0,
    estado              estado_liquidacion NOT NULL DEFAULT 'pendiente',
    fecha_pago          TIMESTAMP,
    CHECK (periodo_hasta >= periodo_desde)
);

CREATE TABLE resenas (
    id              SERIAL PRIMARY KEY,
    producto_id     INT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    usuario_id      INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    puntaje         INT NOT NULL CHECK (puntaje BETWEEN 1 AND 5),
    comentario      TEXT,
    fecha           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE carritos (
    id                  SERIAL PRIMARY KEY,
    usuario_id          INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha_creacion      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE carrito_items (
    id              SERIAL PRIMARY KEY,
    carrito_id      INT NOT NULL REFERENCES carritos(id) ON DELETE CASCADE,
    variante_id     INT NOT NULL REFERENCES producto_variantes(id) ON DELETE CASCADE,
    cantidad        INT NOT NULL CHECK (cantidad > 0),
    UNIQUE (carrito_id, variante_id)
);

-- =====================================================================
-- ÍNDICES ÚTILES PARA CONSULTAS FRECUENTES
-- =====================================================================

CREATE INDEX idx_productos_proveedor ON productos(proveedor_id);
CREATE INDEX idx_productos_categoria ON productos(categoria_id);
CREATE INDEX idx_variantes_producto ON producto_variantes(producto_id);
CREATE INDEX idx_pedido_items_pedido ON pedido_items(pedido_id);
CREATE INDEX idx_pedido_items_proveedor ON pedido_items(proveedor_id);
CREATE INDEX idx_pedidos_usuario ON pedidos(usuario_id);
CREATE INDEX idx_pedidos_fecha ON pedidos(fecha);
