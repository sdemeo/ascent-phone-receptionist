const express = require('express');
const twilio = require('twilio');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(express.urlencoded({ extended: false }));

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const validateTwilioRequest = (req, res, next) => {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioSignature = req.headers['x-twilio-signature'];
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  
  if (twilio.validateRequest(authToken, twilioSignature, url, req.body)) {
    next();
  } else {
    console.error('Invalid Twilio signature');
    res.status(403).send('Forbidden');
  }
};

async function classifyIntent(userSpeech) {
  try {
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
      }]
    });

    const intent = message.content[0].text.trim().toLowerCase();
    console.log(`Classified intent: "${intent}" from speech: "${userSpeech}"`);
    return intent;
  } catch (error) {
    console.error('Claude API error:', error);
    return 'unknown';
  }
}

app.post('/voice', async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  
  console.log('Incoming call:', req.body.From);

  if (!req.body.SpeechResult && !req.body.Digits) {
    twiml.say({
      voice: 'Polly.Joanna'
    }, 'Thank you for calling Ascent Administrative Services. How can I help you? You can say things like claims, dealer support, or agent support.');
    
    twiml.gather({
      input: 'speech',
      timeout: 5,
      speechTimeout: 'auto',
      action: '/voice'
    });
    
    res.type('text/xml');
    res.send(twiml.toString());
    return;
  }

  const userSpeech = req.body.SpeechResult || '';
  console.log('User said:', userSpeech);

  if (!userSpeech) {
    twiml.say('Transferring you to our reception team.');
    twiml.pause({ length: 1 });
    twiml.say('In production, you would now be transferred. Thank you for calling.');
    twiml.hangup();
    
    res.type('text/xml');
    res.send(twiml.toString());
    return;
  }

  const intent = await classifyIntent(userSpeech);

  if (intent === 'claims') {
    const isConfirmation = userSpeech.toLowerCase().includes('yes') || 
                          userSpeech.toLowerCase().includes('all set') ||
                          userSpeech.toLowerCase().includes('that helps') ||
                          userSpeech.toLowerCase().includes("i'm good") ||
                          userSpeech.toLowerCase().includes('no thank');
    
    const needsHelp = userSpeech.toLowerCase().includes('speak to someone') ||
                     userSpeech.toLowerCase().includes('representative') ||
                     userSpeech.toLowerCase().includes('transfer') ||
                     userSpeech.toLowerCase().includes('person');

    if (req.body.CallContext === 'claims_offered' && isConfirmation) {
      twiml.say('Great! Have a wonderful day.');
      twiml.hangup();
    } else if (req.body.CallContext === 'claims_offered' && needsHelp) {
      twiml.say('Transferring you to our claims department.');
      twiml.pause({ length: 1 });
      twiml.say('In production, you would now be connected to a claims specialist. Thank you.');
      twiml.hangup();
    } else {
      twiml.say('To start a claim, please visit claims dot ascent dot com.');
      twiml.pause({ length: 1 });
      twiml.say('Did that answer what you needed, or would you like to speak with someone?');
      
      twiml.gather({
        input: 'speech',
        timeout: 5,
        speechTimeout: 'auto',
        action: '/voice?CallContext=claims_offered'
      });
    }
  } else if (intent === 'onboarding') {
    twiml.say('Transferring you to our onboarding department.');
    twiml.pause({ length: 1 });
    twiml.say('In production, you would now be connected to onboarding. Thank you.');
    twiml.hangup();
  } else {
    twiml.say('Let me transfer you to someone who can help.');
    twiml.pause({ length: 1 });
    twiml.say('In production, you would now be transferred to reception. Thank you.');
    twiml.hangup();
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

app.get('/', (req, res) => {
  res.send('Ascent Administrative Services - Phone Receptionist is running ✓');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
