'use client'

import { useState, useRef, useEffect } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FiSend, FiLoader } from 'react-icons/fi'
import { BiFlag } from 'react-icons/bi'

// TypeScript interfaces based on actual test response schema
interface ImpactSaathiResult {
  answer: string
  related_topics: string[]
  confidence: string
  sources: string[]
}

interface ImpactSaathiMetadata {
  agent_name: string
  timestamp: string
  language_detected: string
}

interface ImpactSaathiResponse {
  status: string
  result: ImpactSaathiResult
  metadata: ImpactSaathiMetadata
}

interface Message {
  role: 'user' | 'agent'
  content: string
  timestamp: Date
  suggestions?: string[]
}

const AGENT_ID = '6985a869b37fff3a03c07cca'

// Welcome Card Component
function WelcomeCard({ onQuickStart }: { onQuickStart: (query: string) => void }) {
  const quickStartQueries = [
    'Summit Schedule',
    'Key Speakers',
    'IndiaAI Mission',
    'Opportunities for Students'
  ]

  return (
    <Card className="max-w-2xl mx-auto shadow-lg border-2 border-orange-100">
      <CardHeader className="text-center pb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-3xl">🙏</span>
          <CardTitle className="text-2xl font-bold text-navy-900">
            Namaste! Welcome to Impact Saathi
          </CardTitle>
        </div>
        <div className="flex items-center justify-center gap-2 text-gray-600">
          <BiFlag className="text-orange-500" />
          <p className="text-sm">Your AI Navigator for the India AI Impact Summit 2026</p>
          <BiFlag className="text-green-600" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">35,000+</div>
            <div className="text-xs text-gray-600">Delegates</div>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-800">100+</div>
            <div className="text-xs text-gray-600">Countries</div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-700">Feb 16-20</div>
            <div className="text-xs text-gray-600">2026</div>
          </div>
        </div>

        <div className="pt-2">
          <p className="text-sm font-semibold text-gray-700 mb-3 text-center">
            Quick Start - Ask about:
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {quickStartQueries.map((query) => (
              <button
                key={query}
                onClick={() => onQuickStart(query)}
                className="px-4 py-2 rounded-full border-2 border-orange-300 text-sm font-medium text-gray-700 hover:bg-orange-50 hover:border-orange-400 transition-colors"
              >
                {query}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Chat Bubble Component
function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}>
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-blue-800 text-white'
              : 'bg-white border border-gray-200 text-gray-800 shadow-md'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Suggestions chips for agent messages */}
        {!isUser && message.suggestions && message.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2 ml-1">
            {message.suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => {
                  const input = document.querySelector('input[name="message"]') as HTMLInputElement
                  if (input) {
                    input.value = suggestion
                    input.focus()
                  }
                }}
                className="px-3 py-1 rounded-full border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-1 px-1">
          {message.timestamp.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </div>
    </div>
  )
}

// Typing Indicator Component
function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-md">
        <div className="flex items-center gap-2">
          <FiLoader className="animate-spin text-orange-500" />
          <p className="text-sm text-gray-600">Impact Saathi is thinking...</p>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const [sessionId] = useState(() => `session-${Date.now()}`)

  // Auto-scroll to latest message
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages, isLoading])

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || inputValue.trim()

    if (!textToSend || isLoading) return

    // Add user message
    const userMessage: Message = {
      role: 'user',
      content: textToSend,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      // Call agent using aiAgent.ts utility
      const result = await callAIAgent(textToSend, AGENT_ID, { session_id: sessionId })

      console.log('Agent API Result:', result)

      if (result.success) {
        let answer = 'No response available'
        let relatedTopics: string[] = []

        // Try to extract structured response
        const responseData = result.response

        // Case 1: Structured response with result.answer
        if (responseData.result?.answer) {
          answer = responseData.result.answer
          relatedTopics = responseData.result.related_topics || []
        }
        // Case 2: Response has text field
        else if (responseData.result?.text) {
          answer = responseData.result.text
        }
        // Case 3: Response has message field
        else if (responseData.message) {
          answer = responseData.message
        }
        // Case 4: Result is a string
        else if (typeof responseData.result === 'string') {
          answer = responseData.result
        }
        // Case 5: Raw response might have the data
        else if (result.raw_response) {
          try {
            const rawParsed = JSON.parse(result.raw_response)
            if (rawParsed.result?.answer) {
              answer = rawParsed.result.answer
              relatedTopics = rawParsed.result.related_topics || []
            } else if (typeof rawParsed === 'string') {
              answer = rawParsed
            }
          } catch {
            answer = result.raw_response
          }
        }

        const agentMessage: Message = {
          role: 'agent',
          content: answer,
          timestamp: new Date(),
          suggestions: relatedTopics.length > 0 ? relatedTopics : undefined
        }

        setMessages(prev => [...prev, agentMessage])
      } else {
        // Error handling
        const errorMessage: Message = {
          role: 'agent',
          content: result.error || 'I apologize, but I encountered an error processing your request. Please try again.',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMessage])
      }
    } catch (error) {
      console.error('Agent call error:', error)
      const errorMessage: Message = {
        role: 'agent',
        content: 'I apologize, but I encountered a network error. Please check your connection and try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickStart = (query: string) => {
    handleSendMessage(query)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Fixed Header - 80px */}
      <header
        className="fixed top-0 left-0 right-0 h-20 bg-gradient-to-r from-orange-50 via-white to-blue-50 border-b border-gray-200 shadow-sm z-10"
        style={{
          backgroundImage: 'linear-gradient(to right, rgba(255, 153, 51, 0.05), rgba(0, 0, 128, 0.05))'
        }}
      >
        <div className="container mx-auto h-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="https://asset.lyzr.app/kpkE1T1X"
              alt="Logo"
              className="h-12 w-auto"
            />
          </div>

          <div className="text-center flex-1">
            <h1 className="text-2xl font-bold text-gray-800">Impact Saathi</h1>
            <p className="text-xs text-gray-600 flex items-center justify-center gap-1">
              <BiFlag className="text-orange-500 text-sm" />
              Your AI Navigator for the India AI Impact Summit 2026
              <BiFlag className="text-green-600 text-sm" />
            </p>
          </div>

          <div className="w-12"></div>
        </div>
      </header>

      {/* Chat Area - Scrollable */}
      <main
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto pt-24 pb-20 px-4"
        style={{
          backgroundImage: 'url(https://asset.lyzr.app/exM1Mccv)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundBlendMode: 'overlay',
          backgroundColor: 'rgba(255, 255, 255, 0.95)'
        }}
      >
        <div className="container mx-auto max-w-4xl">
          {messages.length === 0 && !isLoading && (
            <div className="py-8">
              <WelcomeCard onQuickStart={handleQuickStart} />
            </div>
          )}

          {messages.map((message, idx) => (
            <ChatBubble key={idx} message={message} />
          ))}

          {isLoading && <TypingIndicator />}
        </div>
      </main>

      {/* Fixed Bottom Input Area - 48px + padding */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="container mx-auto max-w-4xl px-4 py-3">
          <div className="flex gap-2 items-center">
            <Input
              name="message"
              type="text"
              placeholder="Ask about the summit, speakers, schedule, or IndiaAI initiatives..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              className="flex-1 h-12 px-4 border-2 border-gray-300 rounded-full focus:border-orange-400 focus:ring-orange-400"
            />
            <Button
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || isLoading}
              className="h-12 w-12 rounded-full bg-blue-800 hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <FiLoader className="animate-spin text-white text-xl" />
              ) : (
                <FiSend className="text-white text-xl" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
