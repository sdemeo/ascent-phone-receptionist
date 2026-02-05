const express = require('express');
const twilio = require('twilio');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(express.urlencoded({ extended: false }));

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Intent classification with keyword detection
async function classifyIntent(userSpeech) {
  try {
    // Keyword detection first (faster and more reliable)
    const lowerSpeech = userSpeech.toLowerCase();
    
    // Claims keywords
    if (lowerSpeech.includes('claim') || 
        lowerSpeech.includes('accident') || 
        lowerSpeech.includes('loss') ||
        lowerSpeech.includes('adjuster') ||
        lowerSpeech.includes('rental') ||
        lowerSpeech.includes('payment') ||
        lowerSpeech.includes('denial')) {
      console.log(`Classified intent: "claims" (keyword match) from speech: "${userSpeech}"`);
      return 'claims';
    }
    
    // Onboarding keywords
    if (lowerSpeech.includes('agent') || 
        lowerSpeech.includes('dealer') || 
        lowerSpeech.includes('onboard') ||
        lowerSpeech.includes('contract') ||
        lowerSpeech.includes('appointment') ||
        lowerSpeech.includes('portal') ||
        lowerSpeech.includes('login') ||
        lowerSpeech.includes('commission') ||
        lowerSpeech.includes('training')) {
      console.log(`Classified intent: "onboarding" (keyword match) from speech: "${userSpeech}"`);
      return 'onboarding';
    }
    
    // Fallback to AI classification for unclear cases
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `You are an intent classifier for Ascent Administrative Services phone system.

Classify the following caller statement into EXACTLY ONE category:
- "claims" - anything about filing claims, claim status, adjusters, accidents, losses, rentals, payments, denials
- "onboarding" - anything about agent support, dealer support, contracting, appointments, becoming an agent/dealer, portals, logins, commissions, training
- "unknown" - unclear or doesn't fit above categories

Caller said: "${userSpeech}"

Respond with ONLY the category name, nothing else.`
