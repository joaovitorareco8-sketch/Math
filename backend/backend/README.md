# Sistema de Ensino Adaptativo — Backend

Node.js + Express + Firestore. Implementa P1–P7 da especificação operacional.

---

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/session/start` | Inicia sessão, retorna plano e primeiro item |
| POST | `/session/answer` | Registra resposta, retorna feedback e próximo item |
| GET | `/student/state?studentId=` | Estado geral do aluno |
| GET | `/student/unit/:unitId?studentId=` | Estado micro de uma unidade |
| GET | `/student/curriculum?studentId=` | Visão macro por bloco |
| POST | `/diagnostic/start` | Inicia diagnóstico inicial |
| POST | `/diagnostic/answer` | Registra resposta do diagnóstico |
| GET | `/health` | Health check |

---

## Deploy no Railway

1. Faça fork ou upload deste repositório no GitHub

2. Acesse [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**

3. Selecione o repositório

4. Vá em **Variables** e adicione:

```
FIREBASE_PROJECT_ID        = seu-project-id
FIREBASE_CLIENT_EMAIL      = seu-service-account@projeto.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY       = -----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
PORT                       = 3000
```

5. Railway detecta o `Procfile` e faz deploy automático

6. A URL pública aparece em **Settings → Domains**

---

## Deploy no Render (alternativa)

1. Acesse [render.com](https://render.com) → **New Web Service**

2. Conecte o repositório GitHub

3. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `node index.js`

4. Adicione as mesmas variáveis de ambiente

5. URL gerada automaticamente após o deploy

---

## Configurar Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com)

2. Crie um projeto → ative **Firestore Database** (modo produção)

3. Vá em **Project Settings → Service Accounts → Generate new private key**

4. Copie `project_id`, `client_email` e `private_key` para as variáveis de ambiente

---

## Rodar localmente

```bash
npm install
cp .env.example .env
# edite .env com suas credenciais Firebase
npm run dev
```

---

## Estrutura

```
src/
  p1_state/          constants, structuralValue, studentState
  p2_assessment/     itemGeneration, evidenceAndDiagnosis
  p3_navigation/     navigation (gate, session planner, CLT load)
  p4_retention/      retention (SM-2, weakening detector)
  p6_metacognition/  calibration (CT.1–CT.5)
  p7_conclusion/     conclusion evaluator + reopen
  db/                firestore client, curriculum dependency map
  templates/         92 templates JSON (KA–KH)
  routes/            session, student, diagnostic
```

---

## Notas

- Todos os thresholds marcados `REQUIRES_CALIBRATION` têm baseline justificado por literatura mas precisam de calibração empírica local
- O sistema é uma especificação de pesquisa aplicada — não validado empiricamente como sistema completo
- Ver `KNOWN_LIMITS` na especificação P1–P7 para limitações conhecidas
