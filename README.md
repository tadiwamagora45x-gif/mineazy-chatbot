# MineAzy WhatsApp AI Assistant

WhatsApp chatbot system for MineAzy Mining Solutions - helps customers with product enquiries, quotations, and support.

## Quick Start

### Prerequisites

- **Node.js v18+** installed
- **Git** (for WhatsApp integration only)
- A **Gemini API key** from [Google AI Studio](https://aistudio.google.com/)

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure Environment

```bash
cd backend
copy .env.example .env
```

Edit `backend/.env` and add your Gemini API key:

```env
GEMINI_API_KEY=your-actual-gemini-api-key
```

### 3. Seed the Database

```bash
cd backend
node src/seed.js
```

This creates the SQLite database with sample products and an admin user.

### 4. Start the Application

Open **two terminals**:

**Terminal 1 - Backend:**
```bash
cd backend
node src/index.js
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npx vite
```

- Backend runs on **http://localhost:3000**
- Frontend runs on **http://localhost:5173**

### 5. Access the Dashboard

Go to **http://localhost:5173** and login:

| Field    | Value                |
|----------|----------------------|
| Email    | admin@mineazy.com    |
| Password | admin123             |

## WhatsApp Integration (Optional)

To enable WhatsApp messaging via Baileys:

```bash
cd backend
npm install @whiskeysockets/baileys pino @hapi/boom
```

Restart the backend. A QR code will appear in the terminal - scan it with WhatsApp to connect.

> **Note:** Baileys requires Git to be installed for dependency resolution.

## Project Structure

```
mineazy-whatsapp/
├── backend/
│   ├── src/
│   │   ├── index.js          # Express server entry
│   │   ├── db.js             # SQLite database (sql.js)
│   │   ├── gemini.js         # Gemini AI integration
│   │   ├── whatsapp.js       # Baileys WhatsApp handler
│   │   ├── seed.js           # Database seeder
│   │   ├── routes/
│   │   │   ├── auth.js       # Login/authentication
│   │   │   ├── dashboard.js  # Dashboard stats
│   │   │   ├── products.js   # Product CRUD
│   │   │   ├── quotations.js # Quotation management
│   │   │   ├── tickets.js    # Support tickets
│   │   │   ├── customers.js  # Customer profiles
│   │   │   ├── conversations.js # Chat history
│   │   │   └── settings.js   # System settings
│   │   └── middleware/
│   │       └── auth.js       # JWT authentication
│   ├── mineazy.db            # SQLite database file
│   ├── .env                  # Environment variables
│   └── auth_info/            # WhatsApp session data
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Router setup
│   │   ├── api.js            # API client
│   │   ├── main.jsx          # Entry point
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Products.jsx
│   │   │   ├── Quotations.jsx
│   │   │   ├── Tickets.jsx
│   │   │   ├── Conversations.jsx
│   │   │   └── Settings.jsx
│   │   └── components/
│   │       └── Layout.jsx    # Sidebar navigation
│   ├── vite.config.js        # Vite + proxy config
│   └── tailwind.config.js
└── package.json              # Root convenience scripts
```

## API Endpoints

| Method | Endpoint              | Description              |
|--------|-----------------------|--------------------------|
| POST   | /api/auth/login       | User login               |
| GET    | /api/auth/me          | Current user info        |
| GET    | /api/dashboard        | Dashboard statistics     |
| GET    | /api/products         | List/search products     |
| POST   | /api/products         | Create product           |
| PUT    | /api/products/:id     | Update product           |
| DELETE | /api/products/:id     | Delete product           |
| GET    | /api/quotations       | List quotations          |
| PUT    | /api/quotations/:id   | Update quotation status  |
| GET    | /api/tickets          | List support tickets     |
| PUT    | /api/tickets/:id      | Update ticket            |
| GET    | /api/conversations    | List conversations       |
| GET    | /api/customers        | List customers           |
| GET    | /api/settings         | Get settings             |
| PUT    | /api/settings         | Update settings          |

## AI Assistant Behavior

The bot uses Gemini with this system prompt:

> You are MineAzy AI Assistant for MineAzy Mining Solutions, a leading supplier of mining equipment, spare parts, and industrial solutions in Zambia.

**Triggers:**
- Customer types "human", "agent", "salesperson", "support" → creates a support ticket and escalates
- Customer requests a quote → triggers quotation request workflow
- Customer asks about products → searches the product catalog and responds with prices/stocks

## Database

All data is stored in `backend/mineazy.db` (SQLite via sql.js, no native compilation required). The database includes:

- **products** - 20 sample mining equipment products
- **customers** - Auto-created when someone messages via WhatsApp
- **conversations** - Chat sessions linked to customers
- **messages** - Individual messages in conversations
- **quotation_requests** - Quote requests with status tracking
- **support_tickets** - Support escalations
- **users** - Admin dashboard users
- **settings** - Company configuration

## Customization

- Edit `backend/src/gemini.js` to modify the AI system prompt and behavior
- Edit `backend/.env` to change admin credentials and JWT secret
- Use the **Settings** page in the dashboard to update company information
- Add new products via the **Products** page in the dashboard
