import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiService, ChatResponse, ChatSource } from '../ai.service';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  sources?: ChatSource[];
}

@Component({
  selector: 'app-ai-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ai-page-wrapper">
    <div class="ai-chat">
      <div class="disclaimer">
        <strong>AI Health Assistant</strong> — Answers are based on your uploaded documents.
        This is not medical advice. Always consult your healthcare provider.
      </div>

      <div class="messages" #messageList>
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
      height: calc(100vh - var(--nav-height, 56px) - 40px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .ai-chat {
      display: flex;
      flex-direction: column;
      flex: 1;
      max-width: 800px;
      width: 100%;
      margin: 0 auto;
      padding: 1rem;
      gap: 0.75rem;
      overflow: hidden;
    }
    .disclaimer {
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 4px;
      padding: 0.6rem 1rem;
      font-size: 0.85rem;
      color: #664d03;
    }
    .messages {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 0.5rem 0;
    }
    .message {
      padding: 0.75rem 1rem;
      border-radius: 8px;
      max-width: 85%;
    }
    .message.user { align-self: flex-end; background: #0d6efd; color: #fff; }
    .message.assistant { align-self: flex-start; background: #f0f0f0; color: #222; }
    .message.loading { opacity: 0.6; }
    .role-label { font-weight: 600; font-size: 0.75rem; text-transform: uppercase; display: block; margin-bottom: 0.25rem; }
    .text { margin: 0; white-space: pre-wrap; }
    .sources { margin-top: 0.5rem; font-size: 0.75rem; opacity: 0.8; }
    .sources-label { font-weight: 600; }
    .source-chip { background: rgba(0,0,0,0.08); border-radius: 3px; padding: 0 4px; margin-right: 4px; }
    .error-banner { background: #f8d7da; border: 1px solid #f5c2c7; color: #842029; padding: 0.6rem 1rem; border-radius: 4px; font-size: 0.9rem; }
    .input-row { display: flex; gap: 0.5rem; }
    .question-input { flex: 1; padding: 0.6rem 0.75rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; }
    .send-btn { padding: 0.6rem 1.25rem; background: #0d6efd; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
    .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  `]
})
export class AiChatComponent implements OnInit {

  messages: Message[] = [];
  question = '';
  loading = false;
  error: string | null = null;
  private conversationId: string | undefined;

  constructor(private ai: AiService) {}

  ngOnInit(): void {
    // No initial greeting — chat starts empty
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
