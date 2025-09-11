import React, {useState, useEffect, useRef} from 'react';
import {Button} from "@/components/ui/button.tsx";
import {Input} from "@/components/ui/input.tsx";
import {Card, CardTitle, CardContent, CardHeader} from "@/components/ui/card.tsx";
import {useWebSocket} from "@/WebSocket/WebSocketContext.tsx";
import {chatService, ChatMessage} from "@/services/ChatService.ts";
import {User} from "@/Interfaces/user/User"
import {userService} from "@/services/UserService.ts";
import {JwtService} from "@/services/JwtService.ts";

interface SpectatorChatProps {
  gameId: string;
  className?: string;
}

interface SpectatorChatMessage extends ChatMessage {
  isSpectatorMessage?: boolean;
}

const SpectatorChat: React.FC<SpectatorChatProps> = ({ gameId, className = "" }) => {
  const [messages, setMessages] = useState<SpectatorChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { client: stompClient, isConnected } = useWebSocket();

  useEffect(() => {
    (async () => {
      try {
        const user: User = await userService.getCurrentUser(JwtService.getKeycloakId()!);
        setCurrentUser(user);
      } catch (error) {
        console.error('Failed to get current user:', error);
      }
    })();
  }, []);

  useEffect(() => {
    if (!stompClient || !currentUser || !isConnected) return;

    const spectatorChatDestination = `/topic/spectator-chat/${gameId}`;
    const subscription = stompClient.subscribe(spectatorChatDestination, (message: any) =>{
      try {
        const chatMessage: SpectatorChatMessage = JSON.parse(message.body);
        setMessages(prev => [...prev, {...chatMessage, isSpectatorMessage: true}]);
      } catch (error) {
        console.error('Error parsing spectator message:', error);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [stompClient, isConnected, gameId, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({behavior: "smooth"});
  }, [messages]);

  const sendMessage = () => {
    if (!newMessage.trim() || !stompClient || !currentUser || !isConnected) return;

    const messageData = {
      senderId: currentUser.id,
      senderName: currentUser.username,
      gameId,
      message: newMessage.trim(),
      timestamp: new Date().toISOString(),
      isSpectatorMessage: true
    };

    stompClient.publish({
      destination: '/app/spectator-chat/send',
      body: JSON.stringify(messageData)
    });

    setNewMessage('');
  };

  const handleKeyPress = (e : React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Card className={`h-full flex flex-col ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <span>👥</span>
          Spectator Chat
          {isConnected ? (
            <span className="text-green-500 text-xs">●</span>
          ) : (
            <span className="text-red-500 text-xs">●</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-3 pt-0">
        {"Messages"}
        <div className="flex-1 overflow-y-auto space-y-2 mb-3 max-h-64">
          {messages.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No Messages Yet, What About Being The First ONE!
            </p>
          ) : (
            messages.map((message, index) => (
              <div key={index} className={`text-xs p-2 rounded-lg ${
                message.senderId === currentUser?.id
                  ? 'bg-primary/20 ml-4'
                  : 'bg-muted/50 mr-4'
              }`}>
                <div className='font-medium text-xs'>
                  {message.senderName}
                  {message.isSpectatorMessage && (
                    <span className="text-muted-foreground ml-1">👁️</span>
                  )}
                </div>
                <div className='text-xs break-words'>
                  {message.message}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Write A Message..."
            className="text-xs"
            disabled={!isConnected}
          />
          <Button
            onClick={sendMessage}
            size="sm"
            disabled={!newMessage.trim() || !isConnected}
            className="px-3"
          >
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  )
};

export default SpectatorChat;
