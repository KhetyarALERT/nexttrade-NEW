export declare const base44: {
  auth: {
    me(): Promise<any>;
    redirectToLogin(nextUrl?: string): void;
    [key: string]: any;
  };
  entities: {
    [key: string]: any;
  };
  functions: {
    invoke(name: string, payload?: any): Promise<any>;
    [key: string]: any;
  };
  agents: {
    listConversations(opts: any): Promise<any>;
    createConversation(opts: any): Promise<any>;
    subscribeToConversation(id: string, cb: (msg: any) => void): any;
    addMessage(opts: any): Promise<any>;
    getConversation(opts: any): Promise<any>;
    [key: string]: any;
  };
  analytics: {
    track(event: any): void;
    [key: string]: any;
  };
  [key: string]: any;
};
