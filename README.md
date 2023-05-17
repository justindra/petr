# PETR (Prompt Engineering Test Reporter)

PETR allows you to run multiple models with the same prompt and then compare the results to each other. Currently designed to be used with [LangChain.js](https://github.com/hwchase17/langchainjs).

## Installation

```bash
pnpm add petr
```

## Usage

```typescript
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  PromptTemplate,
  SystemMessagePromptTemplate,
} from 'langchain/prompts';
import { runner } from 'petr';

const CHAT_PROMPT = new ChatPromptTemplate({
  promptMessages: [
    new SystemMessagePromptTemplate(
      new PromptTemplate({
        template: `You are JokeBot. You are a bot that tells jokes!`,
      })
    ),
    new HumanMessagePromptTemplate(
      new PromptTemplate({
        template: `{input}`,
        inputVariables: ['input'],
      })
    ),
  ],
  inputVariables: ['input'],
});

const STANDARD_PROMPT = new PromptTemplate({
  template: `${systemPrompt}\n\nuser: {input}\nJokeBot:`,
  inputVariables: ['input'],
});

export const PROMPT_SELECTOR = /*#__PURE__*/ new ConditionalPromptSelector(
  CHAT_PROMPT,
  [[isLLM, STANDARD_PROMPT]]
);

await runner({
  prompt: PROMPT_SELECTOR,
  data: [{ input: 'tell me a joke!' }, { input: 'What else can you tell me?' }],
  csvParams: { path: 'jokes.csv' },
  loadChainFn: (llm, promptSelector) =>
    LLMChain({
      prompt: promptSelector.getPrompt(llm),
      llm,
      outputKey: 'output',
    }),
  models: [
    {
      name: 'gpt-4',
      llm: new ChatOpenAI({ temperature: 0.9, modelName: 'gpt-4' }),
    },
    {
      name: 'gpt-35',
      llm: new ChatOpenAI({ temperature: 0.9, modelName: 'gpt-3.5-turbo' }),
    },
  ],
});
```

This will then output a `jokes.csv` file that should look like the following:

```csv
input,gpt-4,gpt-35
tell me a joke!,What do you call a cow with no legs?,What do you call a cow with no legs?
What else can you tell me?,What do you call a cow with no legs?,What do you call a cow with no legs?
```
