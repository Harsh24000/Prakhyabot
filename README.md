# 🚀 Mealzy Bot — Premium Telegram Onboarding Chatbot

A production-grade Telegram bot that feels like chatting with a real fitness coach. Uses AI to conduct natural conversations, collect onboarding data, and deliver instant health insights.

## ✨ Features

- **Human-like conversations** — Zero bot smell. Priya sounds like a real 26-year-old Mumbai fitness coach
- **Concurrent safety** — No duplicate messages when users tap buttons rapidly
- **Skip detection** — Users can skip optional questions naturally
- **Voice transcription** — Optional: users can send voice notes (transcribed via Groq Whisper)
- **Health calculations** — Instant TDEE & BMI shown mid-conversation
- **Personality tags** — Users get labeled ("The Dedicated Athlete", "The Smart Restarter", etc.)
- **Emoji reactions** — Bot reacts contextually to every message
- **Stickers** — Delight moments at milestones
- **Privacy gates** — Trust messages before sensitive sections
- **Section insights** — Personalized coaching tips after each section
- **Progress bar** — Visual progress indicator with milestones
- **Coach forwarding** — Auto-forward completed profiles + photos to coach

## 🏗️ Tech Stack

- **Bot Framework**: grammY (Telegram)
- **LLM**: Groq API (fast, free tier)
- **Runtime**: Node.js 18+
- **Language**: JavaScript (ES modules)

## 📋 Prerequisites

- Node.js 18 or higher
- Telegram account
- Groq API key (free: https://console.groq.com)
- Telegram bot token (create via @BotFather)

## 🚀 Quick Start

### Local Development

```bash
git clone https://github.com/yourusername/mealzy-bot.git
cd mealzy-bot
npm install
cp .env.example .env
# Edit .env with your tokens
npm run dev
