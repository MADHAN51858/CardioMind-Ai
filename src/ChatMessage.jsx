import React, { useState } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip
} from "@mui/material";
import {
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  SmartToy as BotIcon,
  Person as UserIcon
} from "@mui/icons-material";

/**
 * Parses inline formatting like **bold**, *italic*, and `code`
 */
function renderInlineFormattedText(text) {
  if (!text) return null;

  // Split by inline code, bold, and italic regex tokens
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);

  return parts.map((part, idx) => {
    if (!part) return null;

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <Box
          key={idx}
          component="span"
          sx={{
            fontFamily: "monospace",
            bgcolor: "rgba(59, 130, 246, 0.15)",
            color: "#60a5fa",
            px: 0.7,
            py: 0.2,
            borderRadius: 1,
            fontSize: "0.85em",
            border: "1px solid rgba(59, 130, 246, 0.3)"
          }}
        >
          {part.slice(1, -1)}
        </Box>
      );
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <Box key={idx} component="span" sx={{ fontWeight: 700, color: "text.primary" }}>
          {part.slice(2, -2)}
        </Box>
      );
    }

    if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
      return (
        <Box key={idx} component="span" sx={{ fontStyle: "italic", color: "text.secondary" }}>
          {part.slice(1, -1)}
        </Box>
      );
    }

    return part;
  });
}



/**
 * Renders markdown table blocks
 */
function renderMarkdownTable(lines, key) {
  const parseRow = (line) =>
    line
      .split("|")
      .map((c) => c.trim())
      .filter((c, i, arr) => (i === 0 && c === "") || (i === arr.length - 1 && c === "") ? false : true);

  const headerCells = parseRow(lines[0]);
  const bodyRows = lines.slice(2).filter((l) => l.trim().includes("|")).map(parseRow);

  return (
    <TableContainer
      key={key}
      component={Paper}
      sx={{
        my: 2,
        bgcolor: "rgba(15, 23, 42, 0.6)",
        border: "1px solid var(--border-card)",
        borderRadius: 2,
        overflowX: "auto"
      }}
    >
      <Table size="small">
        <TableHead sx={{ bgcolor: "rgba(59, 130, 246, 0.1)" }}>
          <TableRow>
            {headerCells.map((h, i) => (
              <TableCell key={i} sx={{ fontWeight: 700, color: "primary.main", fontSize: "0.85rem", py: 1 }}>
                {renderInlineFormattedText(h)}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {bodyRows.map((row, rIdx) => (
            <TableRow key={rIdx} sx={{ "&:hover": { bgcolor: "rgba(255,255,255,0.03)" } }}>
              {row.map((cell, cIdx) => (
                <TableCell key={cIdx} sx={{ fontSize: "0.82rem", py: 0.9, borderColor: "rgba(255,255,255,0.06)" }}>
                  {renderInlineFormattedText(cell)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/**
 * Parse and render structured Markdown blocks into React elements
 */
function MarkdownRenderer({ content, isStreaming }) {
  if (!content) return null;

  const rawLines = content.split("\n");
  const elements = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // Skip consecutive empty lines
    if (!trimmed) {
      elements.push(<Box key={`empty-${i}`} sx={{ height: 6 }} />);
      i++;
      continue;
    }

    // Markdown Tables
    if (trimmed.startsWith("|") && i + 1 < rawLines.length && rawLines[i + 1].includes("---")) {
      const tableLines = [];
      while (i < rawLines.length && rawLines[i].trim().includes("|")) {
        tableLines.push(rawLines[i]);
        i++;
      }
      elements.push(renderMarkdownTable(tableLines, `table-${i}`));
      continue;
    }

    // Level 3 Heading (###)
    if (trimmed.startsWith("### ")) {
      elements.push(
        <Typography
          key={`h3-${i}`}
          variant="h6"
          sx={{
            fontWeight: 800,
            color: "#60a5fa",
            mt: 2,
            mb: 0.8,
            fontSize: "1.05rem",
            display: "flex",
            alignItems: "center",
            gap: 1
          }}
        >
          {trimmed.replace(/^###\s+/, "")}
        </Typography>
      );
      i++;
      continue;
    }

    // Level 4 Heading (####)
    if (trimmed.startsWith("#### ")) {
      elements.push(
        <Typography
          key={`h4-${i}`}
          variant="subtitle1"
          sx={{
            fontWeight: 700,
            color: "#93c5fd",
            mt: 1.5,
            mb: 0.5,
            fontSize: "0.95rem"
          }}
        >
          {trimmed.replace(/^####\s+/, "")}
        </Typography>
      );
      i++;
      continue;
    }

    // Warning / Emergency callout lines
    if (trimmed.startsWith("⚠️") || trimmed.startsWith("🚨")) {
      elements.push(
        <Box
          key={`callout-${i}`}
          sx={{
            my: 1.5,
            p: 1.5,
            bgcolor: trimmed.startsWith("🚨") ? "rgba(239, 68, 68, 0.12)" : "rgba(245, 158, 11, 0.12)",
            border: `1px solid ${trimmed.startsWith("🚨") ? "rgba(239, 68, 68, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
            borderRadius: 2,
            color: trimmed.startsWith("🚨") ? "#fca5a5" : "#fcd34d"
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {renderInlineFormattedText(trimmed)}
          </Typography>
        </Box>
      );
      i++;
      continue;
    }

    // Horizontal Divider
    if (trimmed === "---" || trimmed === "***") {
      elements.push(
        <Box key={`hr-${i}`} sx={{ my: 2, borderBottom: "1px solid var(--border-card)" }} />
      );
      i++;
      continue;
    }

    // Bullet List Item
    if (/^[-*•]\s+/.test(trimmed)) {
      const text = trimmed.replace(/^[-*•]\s+/, "");
      elements.push(
        <Box
          key={`bullet-${i}`}
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 1.2,
            my: 0.4,
            pl: 1,
            minWidth: 0,
            width: "100%"
          }}
        >
          <Box
            component="span"
            sx={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              bgcolor: "primary.main",
              mt: 1,
              flexShrink: 0
            }}
          />
          <Typography
            variant="body2"
            sx={{
              color: "text.primary",
              lineHeight: 1.6,
              minWidth: 0,
              flex: 1,
              wordBreak: "break-word",
              overflowWrap: "anywhere"
            }}
          >
            {renderInlineFormattedText(text)}
          </Typography>
        </Box>
      );
      i++;
      continue;
    }

    // Numbered List Item
    if (/^\d+\.\s+/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s+(.*)$/);
      if (match) {
        const num = match[1];
        const text = match[2];
        elements.push(
          <Box
            key={`num-${i}`}
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: 1,
              my: 0.4,
              pl: 0.5,
              minWidth: 0,
              width: "100%"
            }}
          >
            <Typography
              variant="body2"
              sx={{ fontWeight: 700, color: "#60a5fa", flexShrink: 0, minWidth: 20 }}
            >
              {num}.
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "text.primary",
                lineHeight: 1.6,
                minWidth: 0,
                flex: 1,
                wordBreak: "break-word",
                overflowWrap: "anywhere"
              }}
            >
              {renderInlineFormattedText(text)}
            </Typography>
          </Box>
        );
        i++;
        continue;
      }
    }

    // Normal paragraph text
    elements.push(
      <Typography
        key={`p-${i}`}
        variant="body2"
        sx={{
          color: "text.primary",
          lineHeight: 1.65,
          my: 0.5,
          minWidth: 0,
          wordBreak: "break-word",
          overflowWrap: "anywhere"
        }}
      >
        {renderInlineFormattedText(trimmed)}
      </Typography>
    );
    i++;
  }

  return (
    <Box sx={{ "& > :first-child": { mt: 0 }, "& > :last-child": { mb: 0 } }}>
      {elements}
      {isStreaming && (
        <Box
          component="span"
          sx={{
            display: "inline-block",
            width: 8,
            height: 15,
            bgcolor: "primary.main",
            ml: 0.5,
            verticalAlign: "middle",
            animation: "cursorBlink 0.9s infinite"
          }}
        />
      )}
    </Box>
  );
}

export default function ChatMessage({ message, isLast, isStreaming }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.sender === "user";

  const handleCopy = () => {
    if (!message.text) return;
    navigator.clipboard.writeText(message.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: isUser ? "row-reverse" : "row",
        alignItems: "flex-start",
        gap: 1.5,
        mb: 2.5,
        width: "100%",
        minWidth: 0
      }}
    >
      {/* Avatar */}
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          bgcolor: isUser ? "primary.main" : "rgba(59, 130, 246, 0.15)",
          border: isUser ? "none" : "1px solid rgba(59, 130, 246, 0.3)",
          color: isUser ? "#fff" : "primary.main"
        }}
      >
        {isUser ? <UserIcon fontSize="small" /> : <BotIcon fontSize="small" />}
      </Box>

      {/* Message Bubble Container */}
      <Box
        sx={{
          maxWidth: isUser ? { xs: "85%", sm: "80%" } : { xs: "90%", sm: "88%" },
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: isUser ? "flex-end" : "flex-start"
        }}
      >
        {/* Header Label for Assistant */}
        {!isUser && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.6, pl: 0.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: "#2563eb" }}>
              CardioAI Clinical Assistant
            </Typography>
            <Chip
              label="Grounded AI"
              size="small"
              sx={{
                height: 18,
                fontSize: "0.68rem",
                bgcolor: "#eff6ff",
                color: "#2563eb",
                fontWeight: 600,
                border: "1px solid #bfdbfe"
              }}
            />
          </Box>
        )}

        {/* Message Bubble */}
        <Box
          sx={{
            p: { xs: 1.8, md: 2.2 },
            borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
            bgcolor: isUser ? "#3b82f6" : "#f8fafc",
            border: isUser ? "none" : "1px solid #e2e8f0",
            boxShadow: isUser
              ? "0 4px 14px rgba(59, 130, 246, 0.25)"
              : "0 2px 8px rgba(0, 0, 0, 0.04)",
            position: "relative",
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            overflow: "hidden",
            color: isUser ? "#ffffff" : "#0f172a"
          }}
        >
          {isUser ? (
            <Typography
              variant="body2"
              sx={{
                color: "#fff",
                whiteSpace: "pre-line",
                lineHeight: 1.6,
                wordBreak: "break-word",
                overflowWrap: "anywhere"
              }}
            >
              {message.text}
            </Typography>
          ) : message.text ? (
            <MarkdownRenderer content={message.text} isStreaming={isLast && isStreaming} />
          ) : (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5 }}>
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  bgcolor: "primary.main",
                  animation: "chatPulse 1.2s infinite ease-in-out both"
                }}
              />
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  bgcolor: "primary.main",
                  animation: "chatPulse 1.2s infinite ease-in-out both 0.2s"
                }}
              />
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  bgcolor: "primary.main",
                  animation: "chatPulse 1.2s infinite ease-in-out both 0.4s"
                }}
              />
              <Typography variant="caption" sx={{ color: "text.secondary", ml: 1 }}>
                CardioAI is analyzing clinical knowledge...
              </Typography>
            </Box>
          )}

          {!isUser && message.text && (
            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
              <Tooltip title={copied ? "Copied!" : "Copy message"}>
                <IconButton
                  size="small"
                  onClick={handleCopy}
                  sx={{
                    color: copied ? "#10b981" : "#94a3b8",
                    p: 0.5,
                    "&:hover": { color: "#2563eb", bgcolor: "#eff6ff" }
                  }}
                >
                  {copied ? <CheckIcon sx={{ fontSize: 16 }} /> : <CopyIcon sx={{ fontSize: 16 }} />}
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
