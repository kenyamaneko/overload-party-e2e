import type { PlayerResponse } from '@kenyamaneko/overload-party-api-gateway';
import type {
  Deck,
  DeckCreateRequest,
  DeckDetailResponse,
  PlayerCardWithDef,
  Product,
} from '@kenyamaneko/overload-party-api-card';
import type {
  ProductResponse,
  PurchaseRequest,
  PurchaseResponse,
} from '@kenyamaneko/overload-party-api-shop';
import type {
  EpisodeWithStatus,
  ScenarioCompleteResponse,
} from '@kenyamaneko/overload-party-api-scenario';
import type { TestIdentity } from './auth.js';

export interface OnboardingNameRequest {
  name: string;
}
export interface OnboardingFactionRequest {
  initial_faction_id: string;
}
export interface OnboardingCompleteResponse {
  message: string;
  player_id: string;
}

export class GatewayClient {
  constructor(
    private readonly baseUrl: string,
    private readonly identity?: TestIdentity,
  ) {}

  registerPlayer(): Promise<PlayerResponse> {
    return this.request<PlayerResponse>('POST', '/api/v1/auth/register');
  }
  loginPlayer(): Promise<PlayerResponse> {
    return this.request<PlayerResponse>('POST', '/api/v1/auth/login');
  }
  getPlayer(): Promise<PlayerResponse> {
    return this.request<PlayerResponse>('GET', '/api/v1/account/me');
  }

  setOnboardingName(name: string): Promise<void> {
    return this.requestVoid('PUT', '/api/v1/scenarios/onboarding/name', {
      name,
    } satisfies OnboardingNameRequest);
  }
  /**
   * Selects the initial faction during onboarding.
   * @param initialFactionId the faction id chosen for the player
   * @returns resolves once the selection is accepted
   */
  selectOnboardingFaction(initialFactionId: string): Promise<void> {
    return this.requestVoid('POST', '/api/v1/scenarios/onboarding/faction', {
      initial_faction_id: initialFactionId,
    } satisfies OnboardingFactionRequest);
  }
  completeOnboarding(): Promise<OnboardingCompleteResponse> {
    return this.request<OnboardingCompleteResponse>(
      'POST',
      '/api/v1/scenarios/onboarding/complete',
    );
  }

  listCards(): Promise<PlayerCardWithDef[]> {
    return this.request<PlayerCardWithDef[]>('GET', '/api/v1/cards/cards/with-ownership');
  }
  listOwnedCards(): Promise<PlayerCardWithDef[]> {
    return this.request<PlayerCardWithDef[]>('GET', '/api/v1/cards/cards');
  }
  /**
   * Lists card-side products with their routine/special initiatives for deck construction.
   * @returns the products a player can build a deck from
   */
  listCardProducts(): Promise<Product[]> {
    return this.request<Product[]>('GET', '/api/v1/cards/products');
  }
  listDecks(): Promise<Deck[]> {
    return this.request<Deck[]>('GET', '/api/v1/cards/decks');
  }
  createDeck(req: DeckCreateRequest): Promise<Deck> {
    return this.request<Deck>('POST', '/api/v1/cards/decks', req);
  }
  getDeck(deckId: number): Promise<DeckDetailResponse> {
    return this.request<DeckDetailResponse>('GET', `/api/v1/cards/decks/${deckId}`);
  }

  listProducts(): Promise<{ products: ProductResponse[] }> {
    return this.request<{ products: ProductResponse[] }>('GET', '/api/v1/shop/products');
  }
  purchase(req: PurchaseRequest): Promise<PurchaseResponse> {
    return this.request<PurchaseResponse>('POST', '/api/v1/shop/purchase', req);
  }

  listScenarios(): Promise<{ episodes: EpisodeWithStatus[] }> {
    return this.request<{ episodes: EpisodeWithStatus[] }>('GET', '/api/v1/scenarios/episodes');
  }
  completeScenario(episodeId: string): Promise<ScenarioCompleteResponse> {
    return this.request<ScenarioCompleteResponse>(
      'POST',
      `/api/v1/scenarios/episodes/${encodeURIComponent(episodeId)}/complete`,
    );
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchRaw(method, path, body);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  private async requestVoid(method: string, path: string, body?: unknown): Promise<void> {
    await this.fetchRaw(method, path, body);
  }

  private async fetchRaw(method: string, path: string, body: unknown): Promise<Response> {
    if (!this.identity) {
      throw new Error(`gateway request ${method} ${path} requires an identity`);
    }
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Authorization': `Bearer ${this.identity.idToken}`,
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new GatewayError(method, path, res.status, text);
    }
    return res;
  }
}

export class GatewayError extends Error {
  constructor(
    public readonly method: string,
    public readonly path: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`gateway ${method} ${path} failed: ${status} ${body}`);
    this.name = 'GatewayError';
  }
}
