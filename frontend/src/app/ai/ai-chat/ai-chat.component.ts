import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiService, ChatResponse, ChatSource } from '../ai.service';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  sources?: ChatSource[];
}

const EXAMPLE_PROMPTS = [
  'What was my most recent blood pressure reading?',
  'Summarize my latest lab report.',
  'Have my glucose levels been trending up or down?',
];

@Component({
  selector: 'app-ai-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ai-page-wrapper">
    <div class="ai-chat">
      <div class="disclaimer">
        <span class="disclaimer__icon" aria-hidden="true">✦</span>
        <span><strong>AI Health Assistant</strong> — Answers are based on your uploaded documents.
        This is not medical advice. Always consult your healthcare provider.</span>
      </div>

      <div class="messages" #messageList>
        <!-- Empty state with example prompts -->
        <div *ngIf="messages.length === 0" class="empty-state">
          <span class="empty-state__icon" aria-hidden="true">✦</span>
          <h2 class="empty-state__title">Ask me anything about your health records</h2>
          <p class="empty-state__text">
            I can answer questions based on the documents you've uploaded — try one of these,
            or ask your own.
          </p>
          <div class="example-prompts">
            <button *ngFor="let p of examplePrompts" class="example-prompt" (click)="ask(p)">
              {{ p }}
            </button>
          </div>
        </div>

        <div *ngFor="let msg of messages" [class]="'message ' + msg.role">
          <span class="role-label">{{ msg.role === 'user' ? 'You' : 'Assistant' }}</span>
          <p class="text">{{ msg.text }}</p>
          <div *ngIf="msg.sources && msg.sources.length > 0" class="sources">
            <span class="sources-label">Sources: </span>
            <span *ngFor="let s of msg.sources; let i = index" class="source-chip">
              Doc {{ s.documentId | slice:0:8 }}… (chunk {{ s.chunkIndex }})
            </span>
          </div>
        </div>

        <div *ngIf="loading" class="message assistant loading">
          <span class="role-label">Assistant</span>
          <p class="text">Thinking…</p>
        </div>
      </div>

      <div *ngIf="error" class="error-banner">{{ error }}</div>

      <form (ngSubmit)="send()" class="input-row">
        <input
          type="text"
          [(ngModel)]="question"
          name="question"
          placeholder="Ask about your health records…"
          [disabled]="loading"
          class="question-input"
          maxlength="2000"
        />
        <button type="submit" [disabled]="!question.trim() || loading" class="send-btn">
          Send
        </button>
      </form>
    </div>
    </div>
  `,
  styles: [`
    .ai-page-wrapper {
      height: calc(100vh - var(--nav-height, 0px) - 40px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--color-surface);
    }
    .ai-chat {
      display: flex;
      flex-direction: column;
      flex: 1;
      max-width: 800px;
      width: 100%;
      margin: 0 auto;
      padding: 1.25rem;
      gap: 0.75rem;
      overflow: hidden;
    }
    .disclaimer {
      display: flex; align-items: flex-start; gap: .6rem;
      background: var(--color-primary-muted);
      border: 1px solid var(--color-primary-light);
      border-radius: var(--radius-md);
      padding: 0.7rem 1rem;
      font-size: 0.8125rem;
      color: var(--color-text-secondary);
    }
    .disclaimer strong { color: var(--color-ink); }
    .disclaimer__icon { color: var(--color-primary); flex-shrink: 0; margin-top: 1px; }
    .messages {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 0.5rem 0;
    }
    .empty-state { padding: 2rem 1rem; }
    .example-prompts {
      display: flex; flex-direction: column; gap: .5rem;
      width: 100%; max-width: 420px; margin-top: .5rem;
    }
    .example-prompt {
      text-align: left; padding: .7rem 1rem;
      background: var(--color-card); border: 1px solid var(--color-border);
      border-radius: var(--radius-md); font-size: .875rem; color: var(--color-text);
      cursor: pointer; font-family: inherit; transition: border-color .12s, background .12s;
    }
    .example-prompt:hover { border-color: var(--color-primary); background: var(--color-primary-muted); }
    .message {
      padding: 0.75rem 1rem;
      border-radius: var(--radius-lg);
      max-width: 85%;
      box-shadow: var(--shadow-sm);
    }
    .message.user { align-self: flex-end; background: var(--color-primary); color: var(--color-text-on-primary); }
    .message.assistant { align-self: flex-start; background: var(--color-card); color: var(--color-text); border: 1px solid var(--color-border); }
    .message.loading { opacity: 0.7; }
    .role-label { font-weight: 700; font-size: 0.6875rem; text-transform: uppercase; letter-spacing: .03em; display: block; margin-bottom: 0.3rem; opacity: .8; }
    .text { margin: 0; white-space: pre-wrap; font-size: .9375rem; line-height: 1.5; }
    .sources { margin-top: 0.5rem; font-size: 0.75rem; opacity: 0.85; }
    .sources-label { font-weight: 600; }
    .source-chip { background: rgba(0,0,0,0.08); border-radius: 3px; padding: 0 4px; margin-right: 4px; }
    .error-banner { background: var(--color-danger-bg); border: 1px solid var(--color-danger); color: var(--color-danger); padding: 0.6rem 1rem; border-radius: var(--radius-md); font-size: 0.9rem; }
    .input-row { display: flex; gap: 0.5rem; }
    .question-input {
      flex: 1; padding: 0.65rem 0.9rem; border: 1.5px solid var(--color-border);
      border-radius: var(--radius-md); font-size: 0.9375rem; font-family: inherit;
      color: var(--color-text); background: var(--color-card); outline: none;
      transition: border-color .15s, box-shadow .15s;
    }
    .question-input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-glow); }
    .send-btn {
      padding: 0.65rem 1.4rem; background: var(--color-primary); color: var(--color-text-on-primary);
      border: none; border-radius: var(--radius-md); cursor: pointer; font-size: 0.9375rem;
      font-weight: 600; font-family: inherit; transition: background .15s;
    }
    .send-btn:hover:not(:disabled) { background: var(--color-primary-dark); }
    .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  `]
})
export class AiChatComponent implements OnInit {

  messages: Message[] = [];
  question = '';
  loading = false;
  error: string | null = null;
  readonly examplePrompts = EXAMPLE_PROMPTS;
  private conversationId: string | undefined;

  constructor(private ai: AiService) {}

  ngOnInit(): void {
    // No initial greeting — empty state with example prompts covers the first-run experience
  }

  ask(prompt: string): void {
    this.question = prompt;
    this.send();
  }

  send(): void {
    const text = this.question.trim();
    if (!text || this.loading) return;

    this.messages.push({ role: 'user', text });
    this.question = '';
    this.loading  = true;
    this.error    = null;

    this.ai.chat(text, this.conversationId).subscribe({
      next: (response: ChatResponse) => {
        this.conversationId = response.conversationId;
        this.messages.push({
          role: 'assistant',
          text: response.answer,
          sources: response.sources
        });
        this.loading = false;
      },
      error: (err) => {
        this.error = 'An error occurred. Please try again.';
        if (err?.status === 503) {
          this.error = 'AI features are not available on this server.';
        }
        this.loading = false;
      }
    });
  }
}
