import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import remarkEmoji from 'remark-emoji'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { Copy, ExternalLink, FileText } from 'lucide-react'

// Import highlight.js for syntax highlighting
import 'highlight.js/styles/github-dark.css'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  content, 
  className = '' 
}) => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  // Custom sanitization schema that allows more HTML elements
  const sanitizeSchema = {
    ...defaultSchema,
    attributes: {
      ...defaultSchema.attributes,
      code: [...(defaultSchema.attributes?.code || []), 'className'],
      pre: [...(defaultSchema.attributes?.pre || []), 'className'],
      span: [...(defaultSchema.attributes?.span || []), 'className'],
      div: [...(defaultSchema.attributes?.div || []), 'className']
    }
  }

  return (
    <div className={`markdown-content prose prose-sm dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[
          remarkGfm,      // GitHub Flavored Markdown (tables, strikethrough, task lists)
          remarkBreaks,   // Convert line breaks to <br>
          remarkEmoji     // Convert emoji shortcodes :smile: to 😊
        ]}
        rehypePlugins={[
          rehypeRaw,      // Allow raw HTML
          [rehypeSanitize, sanitizeSchema], // Sanitize HTML for security
          rehypeHighlight // Syntax highlighting for code blocks
        ]}
        components={{
          // Enhanced code blocks with copy functionality
          code: ({ node, inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '')
            const language = match ? match[1] : 'text'
            const code = String(children).replace(/\n$/, '')
            
            return !inline ? (
              <div className="relative group">
                <div className="flex items-center justify-between bg-gray-800 dark:bg-gray-900 px-4 py-2 rounded-t-lg border-b border-gray-700">
                  <span className="text-xs font-medium text-gray-300 flex items-center space-x-2">
                    <FileText className="w-3 h-3" />
                    <span>{language}</span>
                  </span>
                  <button
                    onClick={() => copyToClipboard(code)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-700 text-gray-300 hover:text-white"
                    title="Copy code"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <pre className="!mt-0 !rounded-t-none bg-gray-900 dark:bg-gray-950 overflow-x-auto">
                  <code className={`${className} !bg-transparent`} {...props}>
                    {children}
                  </code>
                </pre>
              </div>
            ) : (
              <code 
                className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono text-red-600 dark:text-red-400" 
                {...props}
              >
                {children}
              </code>
            )
          },

          // Enhanced blockquotes with better styling
          blockquote: ({ children }: any) => (
            <blockquote className="border-l-4 border-blue-500 dark:border-blue-400 pl-4 py-2 my-4 bg-blue-50 dark:bg-blue-900/20 italic text-gray-700 dark:text-gray-300 rounded-r-lg">
              <div className="flex items-start space-x-2">
                <div className="w-1 h-1 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>{children}</div>
              </div>
            </blockquote>
          ),

          // Enhanced tables with better responsive design
          table: ({ children }: any) => (
            <div className="overflow-x-auto my-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="border-collapse min-w-full text-sm bg-white dark:bg-gray-800">
                {children}
              </table>
            </div>
          ),

          // Table headers with gradient background
          th: ({ children }: any) => (
            <th className="border-b border-gray-200 dark:border-gray-700 px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 font-semibold text-left text-gray-900 dark:text-white">
              {children}
            </th>
          ),

          // Table cells with hover effects
          td: ({ children }: any) => (
            <td className="border-b border-gray-100 dark:border-gray-700 px-4 py-3 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              {children}
            </td>
          ),

          // Enhanced links with external link indicator
          a: ({ children, href }: any) => {
            const isExternal = href && !href.startsWith('#') && !href.startsWith('/')
            return (
              <a 
                href={href} 
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline transition-colors inline-flex items-center space-x-1" 
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
              >
                <span>{children}</span>
                {isExternal && <ExternalLink className="w-3 h-3 ml-1" />}
              </a>
            )
          },

          // Enhanced headings with better spacing and styling
          h1: ({ children }: any) => (
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-6 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
              {children}
            </h1>
          ),

          h2: ({ children }: any) => (
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-5 mb-3 pb-1 border-b border-gray-100 dark:border-gray-800">
              {children}
            </h2>
          ),

          h3: ({ children }: any) => (
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
              {children}
            </h3>
          ),

          h4: ({ children }: any) => (
            <h4 className="text-base font-semibold text-gray-900 dark:text-white mt-3 mb-2">
              {children}
            </h4>
          ),

          h5: ({ children }: any) => (
            <h5 className="text-sm font-semibold text-gray-900 dark:text-white mt-3 mb-2">
              {children}
            </h5>
          ),

          h6: ({ children }: any) => (
            <h6 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mt-3 mb-2 uppercase tracking-wide">
              {children}
            </h6>
          ),

          // Enhanced lists with better spacing
          ul: ({ children }: any) => (
            <ul className="list-disc list-inside space-y-1 my-3 text-gray-900 dark:text-gray-100">
              {children}
            </ul>
          ),

          ol: ({ children }: any) => (
            <ol className="list-decimal list-inside space-y-1 my-3 text-gray-900 dark:text-gray-100">
              {children}
            </ol>
          ),

          li: ({ children }: any) => (
            <li className="text-gray-900 dark:text-gray-100 leading-relaxed">
              {children}
            </li>
          ),

          // Enhanced paragraph spacing
          p: ({ children }: any) => (
            <p className="text-gray-900 dark:text-gray-100 leading-relaxed my-3">
              {children}
            </p>
          ),

          // Enhanced emphasis and strong
          strong: ({ children }: any) => (
            <strong className="font-semibold text-gray-900 dark:text-white">
              {children}
            </strong>
          ),

          em: ({ children }: any) => (
            <em className="italic text-gray-800 dark:text-gray-200">
              {children}
            </em>
          ),

          // Enhanced horizontal rule
          hr: () => (
            <hr className="my-6 border-0 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent" />
          ),

          // Task lists with custom checkboxes
          input: ({ type, checked, ...props }: any) => {
            if (type === 'checkbox') {
              return (
                <input
                  type="checkbox"
                  checked={checked}
                  readOnly
                  className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  {...props}
                />
              )
            }
            return <input type={type} {...props} />
          },

          // Enhanced del (strikethrough)
          del: ({ children }: any) => (
            <del className="line-through text-gray-500 dark:text-gray-400">
              {children}
            </del>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default MarkdownRenderer
