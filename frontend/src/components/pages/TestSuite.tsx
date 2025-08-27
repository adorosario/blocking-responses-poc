import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Play, Download, Settings, RefreshCw, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { notificationManager } from "@/utils/notifications";
import { useConnection } from "@/utils/useConnection";
import { useDashboardStore } from "@/stores/dashboard";
import { apiClient } from "@/utils/api";

// Status badge component
const StatusBadge: React.FC<{ status: string; animate?: boolean }> = ({
  status,
  animate,
}) => {
  const getVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "success";
      case "running":
        return "info";
      case "failed":
        return "danger";
      case "pending":
        return "secondary";
      default:
        return "secondary";
    }
  };

  return (
    <Badge
      variant={getVariant(status)}
      className={animate ? "animate-pulse" : ""}
    >
      {status}
    </Badge>
  );
};

const TestSuite: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  // Add notification functions using notificationManager directly
  const success = (title: string, message: string) => {
    notificationManager.addNotification({
      type: "success",
      title,
      message,
    });
  };

  const error = (title: string, message: string) => {
    notificationManager.addNotification({
      type: "error",
      title,
      message,
    });
  };

  const { testOutput, setTestOutput, appendTestOutput, clearTestOutput } =
    useDashboardStore();
  const [testSuites, setTestSuites] = useState<any[]>([]);
  const [runningTests, setRunningTests] = useState<string[]>([]);
  const [pollingInterval, setPollingInterval] = useState<number | null>(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRunningAll, setIsRunningAll] = useState(false); // Add state for "run all" loading
  const isConnected = useConnection();

  // Load test suites on component mount
  useEffect(() => {
    loadTestSuites();
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [isConnected]);

  // Start polling when tests are running
  useEffect(() => {
    if (runningTests.length > 0 || isRunning) {
      const interval = setInterval(() => {
        // Only poll the server if connected, don't reset local state
        if (isConnected) {
          loadTestSuites();
        }
        // When disconnected, don't call loadTestSuites() to preserve state
      }, 2000); // Poll every 2 seconds
      setPollingInterval(interval);
    } else {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    }

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [runningTests, isRunning, isConnected]);

  const loadTestSuites = async () => {
    if (!isConnected) {
      // Only set default mock data if testSuites is empty (initial load)
      // Otherwise preserve existing state
      if (testSuites.length === 0) {
        setTestSuites([
          {
            id: "basic",
            name: "Basic Functionality",
            description: "Core API endpoints and health checks",
            tests: 3,
            status: "pending",
            passed: 0,
            failed: 0,
            warnings: 0,
            total: 3,
          },
          {
            id: "patterns",
            name: "Pattern Detection",
            description: "Regex pattern detection accuracy",
            tests: 4,
            status: "pending",
            passed: 0,
            failed: 0,
            warnings: 0,
            total: 4,
          },
          {
            id: "presidio",
            name: "Presidio Integration",
            description: "Microsoft Presidio ML detection",
            tests: 3,
            status: "pending",
            passed: 0,
            failed: 0,
            warnings: 0,
            total: 3,
          },
          {
            id: "streaming",
            name: "SSE Streaming",
            description: "Server-Sent Events and validation",
            tests: 3,
            status: "pending",
            passed: 0,
            failed: 0,
            warnings: 0,
            total: 3,
          },
        ]);
      }
      return;
    }

    try {
      const response = await apiClient.getAllTestSuites();
      if (response.success && response.data) {
        setTestSuites(response.data.suites || []);
      }
    } catch (error) {
      console.error("Error loading test suites:", error);
      // Don't reset to empty state on error - preserve existing data
      // error('Failed to refresh', 'Could not load test suites from server')
    }
  };

  // Updated refresh function with loading state and visual feedback
  const handleForceRefresh = async () => {
    setIsRefreshing(true); // Start loading state

    if (!isConnected) {
      // Simulate loading delay for offline mode
      await new Promise((resolve) => setTimeout(resolve, 800));

      // When disconnected, reset all suites to their initial state
      setTestSuites([
        {
          id: "basic",
          name: "Basic Functionality",
          description: "Core API endpoints and health checks",
          tests: 3,
          status: "pending",
          passed: 0,
          failed: 0,
          warnings: 0,
          total: 3,
        },
        {
          id: "patterns",
          name: "Pattern Detection",
          description: "Regex pattern detection accuracy",
          tests: 4,
          status: "pending",
          passed: 0,
          failed: 0,
          warnings: 0,
          total: 4,
        },
        {
          id: "presidio",
          name: "Presidio Integration",
          description: "Microsoft Presidio ML detection",
          tests: 3,
          status: "pending",
          passed: 0,
          failed: 0,
          warnings: 0,
          total: 3,
        },
        {
          id: "streaming",
          name: "SSE Streaming",
          description: "Server-Sent Events and validation",
          tests: 3,
          status: "pending",
          passed: 0,
          failed: 0,
          warnings: 0,
          total: 3,
        },
      ]);

      // Clear test output as well
      clearTestOutput();
      setIsRefreshing(false);
      return;
    }

    try {
      const response = await apiClient.getAllTestSuites();
      if (response.success && response.data) {
        setTestSuites(response.data.suites || []);
      } else {
        error("Refresh Failed", response.error || "Could not load test suites");
      }
    } catch (err) {
      console.error("Error refreshing test suites:", err);
      error("Refresh Failed", "Could not connect to server");
    } finally {
      setIsRefreshing(false); // End loading state
    }
  };

  // Updated handleRunTests with loading state for individual suite buttons
  const handleRunTests = async () => {
    if (!isConnected) return;

    setIsRunning(true);
    setIsRunningAll(true); // Set "run all" loading state
    setTestOutput("🚀 Starting full test suite execution...\n");

    // Set all suites to "running" status to show loading on individual buttons
    setTestSuites((prevSuites) =>
      prevSuites.map((suite) => ({
        ...suite,
        status: "running",
      }))
    );

    try {
      const response = await apiClient.runTestSuite([
        "basic",
        "patterns",
        "presidio",
        "streaming",
      ]);
      if (response.success && response.data) {
        const data = response.data;
        appendTestOutput(`✅ Test session started: ${data.session_id}\n`);
        appendTestOutput(`📊 Status: ${data.status}\n`);

        if (data.output) {
          appendTestOutput(`\n📝 Test Results:\n${data.output}\n`);
        }

        // Update test suites with results
        if (data.summary) {
          appendTestOutput(
            `\n📊 Summary: ${data.summary.passed}/${data.summary.total} tests passed\n`
          );

          // Update local test suites status based on results
          const summary = data.summary;
          setTestSuites((prevSuites) =>
            prevSuites.map((suite) => ({
              ...suite,
              status: "completed",
              passed: Math.floor(summary.passed / prevSuites.length), // Distribute results
              failed: Math.floor(summary.failed / prevSuites.length),
              total: Math.floor(summary.total / prevSuites.length),
            }))
          );

          success(
            "Tests Completed!",
            `Results: ${summary.passed}/${summary.total} tests passed`
          );
        }

        // DO NOT call loadTestSuites() here either
      } else {
        appendTestOutput(`❌ Error: ${response.error}\n`);
        // Reset suite statuses on error
        setTestSuites((prevSuites) =>
          prevSuites.map((suite) => ({
            ...suite,
            status: "failed",
          }))
        );
      }
    } catch (error) {
      appendTestOutput(`💥 Exception: ${error}\n`);
      // Reset suite statuses on exception
      setTestSuites((prevSuites) =>
        prevSuites.map((suite) => ({
          ...suite,
          status: "failed",
        }))
      );
    } finally {
      setIsRunning(false);
      setIsRunningAll(false); // Clear "run all" loading state
    }
  };

  const handleRunSingleSuite = async (suiteId: string) => {
    if (!isConnected) return;

    setRunningTests((prev) => [...prev, suiteId]);
    appendTestOutput(`🔄 Running ${suiteId} suite...\n`);

    // Immediately update the suite status to 'running'
    setTestSuites((prevSuites) =>
      prevSuites.map((suite) =>
        suite.id === suiteId ? { ...suite, status: "running" } : suite
      )
    );

    try {
      const response = await apiClient.runTestSuite([suiteId]);
      if (response.success && response.data) {
        const data = response.data;
        appendTestOutput(`✅ ${suiteId} completed: ${data.status}\n`);

        if (data.output) {
          appendTestOutput(`📝 ${suiteId} output:\n${data.output}\n`);
        }

        // Update specific suite with actual results
        if (data.summary) {
          appendTestOutput(
            `📊 ${suiteId} summary: ${data.summary.passed}/${data.summary.total} tests passed\n`
          );

          const summary = data.summary;
          setTestSuites((prevSuites) =>
            prevSuites.map((suite) =>
              suite.id === suiteId
                ? {
                    ...suite,
                    status: summary.failed > 0 ? "failed" : "completed",
                    passed: summary.passed || 0,
                    failed: summary.failed || 0,
                    // warnings: summary.warnings || 0,
                    total: summary.total || suite.tests || 0,
                  }
                : suite
            )
          );

          success(
            `${suiteId} Completed!`,
            `${summary.passed}/${summary.total} tests passed`
          );
        }

        // DO NOT call loadTestSuites() here - it resets everything!
        // The state update above is sufficient
      } else {
        appendTestOutput(`❌ Error running ${suiteId}: ${response.error}\n`);

        // Update suite status to failed
        setTestSuites((prevSuites) =>
          prevSuites.map((suite) =>
            suite.id === suiteId ? { ...suite, status: "failed" } : suite
          )
        );

        error(`${suiteId} Failed`, response.error || "Unknown error");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      appendTestOutput(`💥 Exception running ${suiteId}: ${errorMsg}\n`);

      // Update suite status to failed
      setTestSuites((prevSuites) =>
        prevSuites.map((suite) =>
          suite.id === suiteId ? { ...suite, status: "failed" } : suite
        )
      );

      error(`${suiteId} Exception`, errorMsg);
    } finally {
      setRunningTests((prev) => prev.filter((id) => id !== suiteId));
    }
  };

  const handleDownloadTestResults = (format: "csv" | "json" | "pdf") => {
    const generateCSV = (data: any[]) => {
      const headers = [
        "Test Suite",
        "Status",
        "Passed",
        "Failed",
        "Warnings",
        "Total",
      ];
      const rows = data.map((suite: any) => [
        suite.name,
        suite.status,
        suite.passed.toString(),
        suite.failed.toString(),
        suite.warnings.toString(),
        suite.total.toString(),
      ]);

      const csvContent = [headers, ...rows]
        .map((row) => row.map((field: any) => `"${field}"`).join(","))
        .join("\n");

      return csvContent;
    };

    const generateJSON = (data: any[]) => {
      return JSON.stringify(data, null, 2);
    };

    const generatePDF = (data: any[]) => {
      // Simple PDF-like text format
      let content = "TEST RESULTS REPORT\n";
      content += "==================\n\n";
      content += `Generated: ${new Date().toLocaleDateString()}\n\n`;

      data.forEach((suite: any) => {
        content += `${suite.name}\n`;
        content += `Status: ${suite.status}\n`;
        content += `Passed: ${suite.passed}, Failed: ${suite.failed}, Warnings: ${suite.warnings}\n`;
        content += `Total: ${suite.total}\n\n`;
      });

      return content;
    };

    try {
      const currentTestResults = testSuites.map((suite) => ({
        name: suite.name,
        status: suite.status || "Not Run",
        passed: suite.passed || 0,
        failed: suite.failed || 0,
        warnings: suite.warnings || 0,
        total: suite.total || suite.tests || 0,
      }));

      let content: string;
      let filename: string;
      let mimeType: string;

      switch (format) {
        case "csv":
          content = generateCSV(currentTestResults);
          filename = `test-results-${
            new Date().toISOString().split("T")[0]
          }.csv`;
          mimeType = "text/csv";
          break;
        case "json":
          content = generateJSON(currentTestResults);
          filename = `test-results-${
            new Date().toISOString().split("T")[0]
          }.json`;
          mimeType = "application/json";
          break;
        case "pdf":
          content = generatePDF(currentTestResults);
          filename = `test-results-${
            new Date().toISOString().split("T")[0]
          }.txt`;
          mimeType = "text/plain";
          break;
        default:
          throw new Error("Unsupported format");
      }

      const blob = new Blob([content], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      error("Download Failed", "Failed to download test results");
    }
  };

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [testConfig, setTestConfig] = useState({
    timeout: 60,
    verboseOutput: true,
    parallelExecution: false,
    coverageReports: true,
    continueOnFailure: false,
    showWarnings: true,
  });

  const handleConfigure = () => {
    setShowConfigModal(true);
  };

  const handleSaveConfig = () => {
    setShowConfigModal(false);
    success("Configuration Saved", "Test configuration updated successfully!");
  };

  const handleClearOutput = () => {
    clearTestOutput();
    success("Output Cleared", "Test output has been cleared!");
  };

  const handleDownloadSuiteResults = (suiteId: string) => {
    const suite = testSuites.find((s) => s.id === suiteId);
    if (!suite) return;

    const suiteData = [
      {
        name: suite.name,
        status: suite.status || "Not Run",
        passed: suite.passed || 0,
        failed: suite.failed || 0,
        warnings: suite.warnings || 0,
        total: suite.total || suite.tests || 0,
      },
    ];

    try {
      const content = suiteData
        .map(
          (suite) =>
            `${suite.name},${suite.status},${suite.passed},${suite.failed},${suite.warnings},${suite.total}`
        )
        .join("\n");

      const csvContent =
        "Test Suite,Status,Passed,Failed,Warnings,Total\n" + content;

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${suite.name
        .toLowerCase()
        .replace(/\s+/g, "-")}-results-${
        new Date().toISOString().split("T")[0]
      }.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      error("Download Failed", `Failed to download ${suite.name} results`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Test Suite
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Comprehensive testing and validation framework
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:space-x-3">
          <Button
            onClick={handleRunTests}
            disabled={isRunning || runningTests.length > 0}
            loading={isRunning}
            icon={
              isRunning ? (
                <RefreshCw className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )
            }
            iconPosition="left"
            className="flex-shrink-0"
          >
            <span className="hidden sm:inline">
              {isRunning ? "Running All Tests..." : "Run All Tests"}
            </span>
            <span className="sm:hidden">
              {isRunning ? "Running..." : "Run All"}
            </span>
          </Button>

          <Button
            variant="outline"
            onClick={() => window.location.assign('/audit')}
            icon={<Eye className="w-4 h-4" />}
            iconPosition="left"
            className="flex-shrink-0"
            title="View Audit Logs"
          >
            <span className="hidden sm:inline">Audit Logs</span>
            <span className="sm:hidden">Audit</span>
          </Button>

          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              icon={<Download className="w-4 h-4" />}
              iconPosition="left"
              className="flex-shrink-0"
            >
              <span className="hidden sm:inline">Export Results</span>
              <span className="sm:hidden">Export</span>
            </Button>

            {showDownloadMenu && (
              <div className="absolute right-0 mt-2 w-32 sm:w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                <div className="py-1">
                  <button
                    onClick={() => {
                      handleDownloadTestResults("csv");
                      setShowDownloadMenu(false);
                    }}
                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
                  >
                    Download CSV
                  </button>
                  <button
                    onClick={() => {
                      handleDownloadTestResults("json");
                      setShowDownloadMenu(false);
                    }}
                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
                  >
                    Download JSON
                  </button>
                  <button
                    onClick={() => {
                      handleDownloadTestResults("pdf");
                      setShowDownloadMenu(false);
                    }}
                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
                  >
                    Download PDF
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Updated Refresh Button with loading state */}
          <Button
            variant="outline"
            onClick={handleForceRefresh}
            disabled={isRunning || isRefreshing}
            loading={isRefreshing}
            icon={
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            }
            iconPosition="left"
            className="flex-shrink-0"
          >
            <span className="hidden sm:inline">
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </span>
            <span className="sm:hidden">
              {isRefreshing ? "Loading..." : "Refresh"}
            </span>
          </Button>

          <Button
            variant="ghost"
            onClick={handleConfigure}
            icon={<Settings className="w-4 h-4" />}
            iconPosition="left"
            className="flex-shrink-0"
          ></Button>
        </div>
      </motion.div>

      {/* Connection Status Warning */}
      {!isConnected && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4"
        >
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            <span className="text-amber-800 dark:text-amber-200 font-medium">
              Connection to backend API is unavailable. Some features may be
              limited.
            </span>
          </div>
        </motion.div>
      )}

      {/* Add refresh indicator overlay when refreshing */}
      {isRefreshing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed top-4 right-4 z-50 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2"
        >
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm font-medium">Refreshing test suites...</span>
        </motion.div>
      )}

      {/* Add "running all tests" indicator overlay */}
      {isRunningAll && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed top-16 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2"
        >
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm font-medium">
            Running all test suites...
          </span>
        </motion.div>
      )}

      {/* Test Suites Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6"
      >
        {testSuites.map((suite: any, index: number) => {
          // Calculate actual progress
          const totalCompleted = (suite.passed || 0) + (suite.failed || 0);
          const totalTests = suite.total || suite.tests || 0;
          const progressPercentage =
            totalTests > 0 ? (totalCompleted / totalTests) * 100 : 0;

          // Check if this suite is running (either individually or as part of "run all")
          const isSuiteRunning =
            runningTests.includes(suite.id) ||
            (isRunningAll && suite.status === "running");

          return (
            <motion.div
              key={suite.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
              className={`${
                isRefreshing ? "opacity-70" : "opacity-100"
              } transition-opacity duration-300`}
            >
              <Card hover className="h-full">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <CardTitle size="sm" className="text-base sm:text-lg">
                      {suite.name}
                    </CardTitle>
                    <StatusBadge
                      status={suite.status}
                      animate={isSuiteRunning}
                    />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {suite.description}
                  </p>
                </CardHeader>

                <CardContent>
                  <div className="space-y-4">
                    {/* Fixed Progress Bar */}
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600 dark:text-gray-400">
                          Progress
                        </span>
                        <span className="font-medium">
                          {totalCompleted} / {totalTests}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progressPercentage}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className={`h-2 rounded-full ${
                            suite.status === "completed" && suite.failed === 0
                              ? "bg-success-600"
                              : suite.status === "failed" || suite.failed > 0
                              ? "bg-danger-600"
                              : suite.status === "running"
                              ? "bg-primary-600"
                              : "bg-gray-400"
                          }`}
                        />
                      </div>
                    </div>

                    {/* Fixed Test Results */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <div className="text-xl sm:text-2xl font-bold text-success-600 dark:text-success-400">
                          {suite.passed || 0}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Passed
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl sm:text-2xl font-bold text-danger-600 dark:text-danger-400">
                          {suite.failed || 0}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Failed
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl sm:text-2xl font-bold text-warning-600 dark:text-warning-400">
                          {suite.warnings || 0}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Warnings
                        </div>
                      </div>
                    </div>

                    {/* Updated Actions with better loading state handling */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        disabled={
                          isRunning ||
                          runningTests.includes(suite.id) ||
                          isRefreshing ||
                          isRunningAll
                        }
                        onClick={() => handleRunSingleSuite(suite.id)}
                        loading={isSuiteRunning}
                        icon={
                          isSuiteRunning ? (
                            <RefreshCw className="w-3 h-3" />
                          ) : (
                            <Play className="w-3 h-3" />
                          )
                        }
                        iconPosition="left"
                      >
                        {isSuiteRunning ? "Running..." : "Run Suite"}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadSuiteResults(suite.id)}
                        icon={<Download className="w-5 h-5 hover:scale-110" />}
                        iconPosition="left"
                        className="sm:w-auto w-full"
                        disabled={
                          suite.status === "pending" ||
                          totalCompleted === 0 ||
                          isRefreshing ||
                          isRunningAll
                        }
                        title={`Download ${suite.name} results`}
                      >
                        <span className="sm:hidden">Download Suite</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Rest of your JSX remains the same... */}
      {/* Live Test Output */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Live Test Output</CardTitle>
              {testOutput && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleClearOutput}
                  icon={<RefreshCw className="w-3 h-3" />}
                  iconPosition="left"
                  className="text-xs"
                >
                  Clear Output
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 font-mono text-sm min-h-[300px] max-h-[400px] overflow-y-auto">
              {testOutput ? (
                <pre className="text-green-400 whitespace-pre-wrap">
                  {testOutput}
                </pre>
              ) : (
                <div className="text-gray-500">
                  Test output will appear here when tests are running...
                </div>
              )}
              {isRunning && !testOutput && (
                <div className="text-yellow-400 animate-pulse">
                  → Running compliance detection tests...
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-lg border dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Test Configuration
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Test Timeout (seconds)
                </label>
                <input
                  type="number"
                  value={testConfig.timeout}
                  onChange={(e) =>
                    setTestConfig({
                      ...testConfig,
                      timeout: parseInt(e.target.value),
                    })
                  }
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="10"
                  max="300"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="verboseOutput"
                  checked={testConfig.verboseOutput}
                  onChange={(e) =>
                    setTestConfig({
                      ...testConfig,
                      verboseOutput: e.target.checked,
                    })
                  }
                  className="mr-3 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <label
                  htmlFor="verboseOutput"
                  className="text-sm text-gray-700 dark:text-gray-300"
                >
                  Verbose output
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="parallelExecution"
                  checked={testConfig.parallelExecution}
                  onChange={(e) =>
                    setTestConfig({
                      ...testConfig,
                      parallelExecution: e.target.checked,
                    })
                  }
                  className="mr-3 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <label
                  htmlFor="parallelExecution"
                  className="text-sm text-gray-700 dark:text-gray-300"
                >
                  Parallel execution
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="coverageReports"
                  checked={testConfig.coverageReports}
                  onChange={(e) =>
                    setTestConfig({
                      ...testConfig,
                      coverageReports: e.target.checked,
                    })
                  }
                  className="mr-3 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <label
                  htmlFor="coverageReports"
                  className="text-sm text-gray-700 dark:text-gray-300"
                >
                  Generate coverage reports
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="continueOnFailure"
                  checked={testConfig.continueOnFailure}
                  onChange={(e) =>
                    setTestConfig({
                      ...testConfig,
                      continueOnFailure: e.target.checked,
                    })
                  }
                  className="mr-3 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <label
                  htmlFor="continueOnFailure"
                  className="text-sm text-gray-700 dark:text-gray-300"
                >
                  Continue on failure
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="showWarnings"
                  checked={testConfig.showWarnings}
                  onChange={(e) =>
                    setTestConfig({
                      ...testConfig,
                      showWarnings: e.target.checked,
                    })
                  }
                  className="mr-3 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <label
                  htmlFor="showWarnings"
                  className="text-sm text-gray-700 dark:text-gray-300"
                >
                  Show warnings
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button
                variant="secondary"
                onClick={() => setShowConfigModal(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveConfig}>Save Configuration</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestSuite;
