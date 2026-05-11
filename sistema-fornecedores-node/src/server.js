require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const axios = require('axios');
const bcrypt = require('bcrypt');

const prisma = require('./lib/prisma');
const app = express();
const upload = multer({ dest: 'uploads/' });
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');

function parseConfiguredEmails(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function getBootstrapSuperAdminEmails() {
  return Array.from(
    new Set(
      [
        'superadmin@conformix.local',
        String(process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL || '').trim().toLowerCase(),
        ...parseConfiguredEmails(process.env.SUPER_ADMIN_EMAILS)
      ].filter(Boolean)
    )
  );
}

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

app.get('/api', (req, res) => {
  res.send('API OK');
});

app.get('/cnpj/:cnpj', async (req, res) => {
  try {
    const data = await axios.get(
      `https://brasilapi.com.br/api/cnpj/v1/${req.params.cnpj}`
    );

    res.json(data.data);
  } catch (error) {
    res.status(400).json({ error: 'Nao foi possivel consultar o CNPJ.' });
  }
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  res.json(req.file);
});

app.get('/api/categories', async (req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { id: 'asc' },
  });

  res.json(
    categories.map((category) => ({
      ...category,
      questions: JSON.parse(category.questions || '[]'),
      documents: JSON.parse(category.documents || '[]'),
    }))
  );
});

const authRoutes = require('./routes/authRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const evaluationRoutes = require('./routes/evaluationRoutes');
const rncRoutes = require('./routes/rncRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/rnc', rncRoutes);

if (require('fs').existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));

  app.get(/^\/(?!api(?:\/|$)).*/, (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('API rodando');
  });
}

async function ensureDefaultCategory() {
  const total = await prisma.category.count();

  if (!total) {
    await prisma.category.create({
      data: {
        name: 'Critico',
        description: 'Categoria dinamica para fornecedores com maior impacto operacional.',
        questions: JSON.stringify(['Entrega no prazo?', 'Qualidade?']),
        documents: JSON.stringify(['ISO 9001', 'Certificado']),
      },
    });
  }
}

async function ensureConfiguredUsers() {
  const bootstrapPassword = String(process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD || '');
  const configuredEmails = new Set(getBootstrapSuperAdminEmails());

  const configuredUsers = [...configuredEmails].map((email) => ({
    email,
    password: bootstrapPassword
  })).filter((item) => item.email && item.password);

  for (const account of configuredUsers) {
    const normalizedEmail = account.email.trim().toLowerCase();
    const hashedPassword = await bcrypt.hash(account.password, 10);

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, password: true }
    });

    if (!existingUser) {
      await prisma.user.create({
        data: {
          email: normalizedEmail,
          password: hashedPassword
        }
      });
      continue;
    }

    const samePassword =
      !existingUser.password.startsWith('supabase:') &&
      (await bcrypt.compare(account.password, existingUser.password));

    if (!samePassword) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { password: hashedPassword }
      });
    }
  }
}

async function startServer() {
  await ensureDefaultCategory();
  await ensureConfiguredUsers();

  app.listen(process.env.PORT, () => {
    console.log(`Servidor rodando na porta ${process.env.PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Erro ao iniciar servidor:', error);
  process.exit(1);
});
