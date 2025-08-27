import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Activity,
  TrendingUp,
  Clock,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  MetricCard,
  CounterMetric,
  PercentageMetric,
  DurationMetric,
} from "@/components/ui/MetricCard";
import { useNotifications } from "@/components/ui/Notifications";
import { useDashboardStore, useTestSuiteStats } from "@/stores/dashboard";
import { formatters } from "@/utils";
import { useConnection } from "@/utils/useConnection";
import MetricsChart from "@/components/charts/MetricsChart";
import ComplianceBreakdown from "@/components/charts/ComplianceBreakdown";
import RecentActivity from "@/components/RecentActivity";
import { apiClient } from "@/utils/api";
import { AuditEvent } from "@/types";

const Dashboard: React.FC = () => {
  const {
    realtimeMetrics,
    testSuiteResults,
    lastUpdate,
    updateMetrics,
    setAuditEvents,
    setTestOutput,
    appendTestOutput,
  } = useDashboardStore();

  const isConnected = useConnection();
  const testStats = useTestSuiteStats();
  const navigate = useNavigate();
  const { success, error } = useNotifications();

  // Quick Action handlers
  const handleRunTestSuite = async () => {
    try {
      // Clear and start fresh output
      setTestOutput("🚀 Starting full test suite execution...\n");
      
      // First test simple compliance assessment to generate real data
      const testMessage = "Test SSN: 123-45-6789 for compliance blocking";
      appendTestOutput(
        `📝 Testing compliance with message: "${testMessage}"\n`
      );

      const assessmentResponse = await apiClient.assessRisk(testMessage);
      if (assessmentResponse.success) {
        appendTestOutput(
          `⚡ Risk assessment complete: Score ${assessmentResponse.data?.score}, Blocked: ${assessmentResponse.data?.blocked}\n`
        );
      }

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
          appendTestOutput(`\n📝 Test Output:\n${data.output}\n`);
        }
        
        // Navigate to test suite page with output preserved
        navigate("/testing");
        
        // Show success notification with actual results
        const { passed, failed, total } = response.data.summary || {
          passed: 0,
          failed: 0,
          total: 0,
        };
        success(
          "Test Suite Completed!",
          `Results: ${passed} passed, ${failed} failed, ${total} total tests. Session: ${response.data.session_id}`
        );
      } else {
        error("Test Suite Failed", response.error || "Unknown error occurred");
      }
    } catch (err) {
      error("Test Suite Error", `Failed to start test suite: ${err}`);
    }
  };

    const handleViewLiveStream = () => {
    // Navigate to stream monitor page
    navigate("/stream");
  };

  const handleExportAuditReport = async () => {
    try {
      const response = await apiClient.getAuditLogs(1000);
      if (response.success && response.data) {
        // Create CSV data
        const csvData = response.data.logs.map((event: AuditEvent) => ({
          timestamp: event.timestamp,
          event_type: event.event_type,
          compliance_type: event.compliance_type,
          risk_score: event.risk_score,
          blocked: event.blocked,
          session_id: event.session_id,
        }));
        
        // Convert to CSV string
        const csvContent = [
          "Timestamp,Event Type,Compliance Type,Risk Score,Blocked,Session ID",
          ...csvData.map(
            (row: any) =>
            `${row.timestamp},${row.event_type},${row.compliance_type},${row.risk_score},${row.blocked},${row.session_id}`
          ),
        ].join("\n");
        
        // Download CSV
        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audit-report-${
          new Date().toISOString().split("T")[0]
        }.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Error exporting audit report:", error);
    }
  };

  const handleSystemHealthCheck = async () => {
    try {
      const response = await apiClient.getHealth();
      if (response.success) {
        success(
          "System Healthy",
          `Status: ${response.data?.status} | Version: ${response.data?.version} | All dependencies operational`
        );
      } else {
        error(
          "Health Check Failed",
          response.error || "Unknown error occurred"
        );
      }
    } catch (err) {
      error("Health Check Error", `Failed to check system health: ${err}`);
    }
  };

  // Fetch initial metrics data
  useEffect(() => {
    const fetchMetrics = async () => {
      if (isConnected) {
        try {
          // Fetch metrics
          const metricsResponse = await apiClient.getMetrics();
          if (metricsResponse.success && metricsResponse.data) {
            updateMetrics(metricsResponse.data);
            
            // Add historical metric point for charting
            const historicalPoint = {
              timestamp: new Date().toISOString(),
              total_requests: metricsResponse.data.total_requests,
              blocked_requests: metricsResponse.data.blocked_requests,
              block_rate: metricsResponse.data.block_rate,
              avg_risk_score: metricsResponse.data.avg_risk_score,
              avg_processing_time:
                metricsResponse.data.performance_metrics.avg_processing_time,
              requests_per_second:
                metricsResponse.data.performance_metrics.requests_per_second,
            };
            useDashboardStore.getState().addHistoricalMetric(historicalPoint);
          }
          
          // Fetch recent audit events for dashboard components
          const auditResponse = await apiClient.getAuditLogs(50);
          if (auditResponse.success && auditResponse.data) {
            setAuditEvents(auditResponse.data.logs || []);
          }
        } catch (error) {
          console.error("Failed to fetch dashboard data:", error);
        }
      }
    };

    fetchMetrics();
    
    // Set up more frequent metrics refresh for live updates (every 5 seconds)
    const interval = setInterval(fetchMetrics, 5000); // Every 5 seconds
    
    return () => clearInterval(interval);
  }, [isConnected, updateMetrics, setAuditEvents]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 },
  };

  // Calculate key metrics
  const blockRate = realtimeMetrics.block_rate;
  const avgProcessingTime =
    realtimeMetrics.performance_metrics.avg_processing_time;
  const totalPatternDetections = Object.values(
    realtimeMetrics.pattern_detections
  ).reduce((sum, count) => sum + count, 0);
  const totalPresidioDetections = Object.values(
    realtimeMetrics.presidio_detections
  ).reduce((sum, count) => sum + count, 0);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-3 xs:space-y-4 sm:space-y-5 md:space-y-6"
    >
      {/* Welcome copy + Primary CTA */}
      <motion.div variants={itemVariants}>
        <Card className="bg-gradient-to-br from-blue-50 via-white to-blue-100 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 shadow-md rounded-2xl p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex-1 text-left space-y-2">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                Welcome to Compliance AI
              </h2>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                Analyze any text for sensitive data, assess risk in real time,
                and keep your content compliant.
              </p>
            </div>
            <div className="flex-shrink-0 self-center md:self-auto">
              <Button
                variant="primary"
                size="xl"
                rounded="full"
                shadow="lg"
                icon={<MessageSquare className="w-5 h-5" />}
                onClick={() => navigate("/stream")}
                className="px-8"
              >
                New Request
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Hero Stats - Enhanced with MetricCards */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 xs:grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 xs:gap-4 sm:gap-5 lg:gap-6"
      >
        <CounterMetric
          title="Total Requests"
          count={realtimeMetrics.total_requests}
          description={`${realtimeMetrics.performance_metrics.requests_per_second.toFixed(
            1
          )} req/sec`}
          icon={Activity}
          variant="gradient"
          color="blue"
          size="responsive"
          animated={true}
        />

        <PercentageMetric
          title="Block Rate"
          percentage={blockRate}
          description={`${realtimeMetrics.blocked_requests} blocked`}
          icon={
            blockRate > 10
              ? AlertTriangle
              : blockRate > 5
              ? Shield
              : CheckCircle
          }
          variant="gradient"
          color={blockRate > 10 ? "red" : blockRate > 5 ? "yellow" : "green"}
          size="responsive"
          animated={true}
        />

        <MetricCard
          title="Max Risk Score"
          value={realtimeMetrics.max_risk_score.toFixed(2)}
          icon={TrendingUp}
          variant="elevated"
          color={
            realtimeMetrics.max_risk_score >= 0.8
              ? "red"
              : realtimeMetrics.max_risk_score >= 0.5
              ? "yellow"
              : "green"
          }
          size="responsive"
          animated={true}
        />

        <DurationMetric
          title="Processing Time"
          milliseconds={avgProcessingTime}
          description="Average response"
          icon={Clock}
          variant="elevated"
          size="responsive"
          animated={true}
        />
      </motion.div>

      {/* Analysis Windows Stats */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 xs:gap-4 sm:gap-5 lg:gap-6"
      >
        {/* Stat Pill: Input Windows */}
        <div className="relative overflow-hidden rounded-2xl p-4 sm:p-5 lg:p-6 border-2 border-blue-300 dark:border-blue-500/30 shadow-soft dark:bg-gradient-to-br dark:from-gray-800/40 dark:via-gray-800/20 dark:to-transparent ring-1 ring-blue-500/10 dark:ring-blue-500/20">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-blue-500/60 to-cyan-400/60" />
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs xs:text-sm text-gray-500 dark:text-gray-400">Input Windows</div>
              <div className="text-2xl xs:text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {realtimeMetrics.input_windows_analyzed.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">User input analyzed</div>
            </div>
            <div className="shrink-0 rounded-xl p-2 bg-blue-50 ring-1 ring-blue-200 text-blue-600 dark:bg-blue-500/15 dark:ring-blue-400/20 dark:text-blue-400">
              <Activity className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Stat Pill: Response Windows */}
        <div className="relative overflow-hidden rounded-2xl p-4 sm:p-5 lg:p-6 border-2 border-emerald-300 dark:border-emerald-500/30 shadow-soft dark:bg-gradient-to-br dark:from-gray-800/40 dark:via-gray-800/20 dark:to-transparent ring-1 ring-emerald-500/10 dark:ring-emerald-500/20">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-emerald-500/60 to-green-400/60" />
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs xs:text-sm text-gray-500 dark:text-gray-400">Response Windows</div>
              <div className="text-2xl xs:text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {realtimeMetrics.response_windows_analyzed.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">AI response analyzed</div>
            </div>
            <div className="shrink-0 rounded-xl p-2 bg-emerald-50 ring-1 ring-emerald-200 text-emerald-600 dark:bg-emerald-500/15 dark:ring-emerald-400/20 dark:text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Stat Pill: Avg Risk Score */}
        <div className={`relative overflow-hidden rounded-2xl p-4 sm:p-5 lg:p-6 border-2 shadow-soft dark:bg-gradient-to-br dark:from-gray-800/40 dark:via-gray-800/20 dark:to-transparent ring-1 dark:ring-emerald-500/20 ${
          realtimeMetrics.avg_risk_score >= 0.8
            ? 'border-red-300'
            : realtimeMetrics.avg_risk_score >= 0.5
            ? 'border-yellow-300'
            : 'border-emerald-600'
        }`}
          style={{
            // dynamic ring color based on severity
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.03)'
          }}
        >
          {/* Left accent bar matching severity */}
          <div className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${
            realtimeMetrics.avg_risk_score >= 0.8
              ? 'from-red-500/70 to-red-400/70'
              : realtimeMetrics.avg_risk_score >= 0.5
              ? 'from-yellow-500/70 to-orange-400/70'
              : 'from-emerald-500/70 to-green-400/70'
          }`} />
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs xs:text-sm text-gray-500 dark:text-gray-400">Avg Risk Score</div>
              <div className="text-2xl xs:text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {realtimeMetrics.avg_risk_score.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500 mt-1">Lower is safer</div>
            </div>
            <div className={`shrink-0 rounded-xl p-2 ring-1 ${
              realtimeMetrics.avg_risk_score >= 0.8
                ? 'bg-red-100 ring-red-200 text-red-600 dark:bg-red-500/15 dark:ring-red-400/20 dark:text-red-400'
                : realtimeMetrics.avg_risk_score >= 0.5
                ? 'bg-yellow-100 ring-yellow-200 text-yellow-600 dark:bg-yellow-500/15 dark:ring-yellow-400/20 dark:text-yellow-400'
                : 'bg-emerald-100 ring-emerald-200 text-emerald-600 dark:bg-emerald-500/15 dark:ring-emerald-400/20 dark:text-emerald-400'
            }`}>
              <TrendingUp className={`w-5 h-5`} />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Test Suite Status */}
      {testSuiteResults.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Test Suite Status</CardTitle>
                <Badge variant="info">{testStats.totalSuites} Suites</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-success-600 dark:text-success-400">
                    {testStats.passedTests}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Passed Tests
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-danger-600 dark:text-danger-400">
                    {testStats.failedTests}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Failed Tests
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                    {testStats.successRate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Success Rate
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Overall Progress</span>
                  <span className="text-sm text-gray-500">
                    {testStats.passedTests + testStats.failedTests} /{" "}
                    {testStats.totalTests}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-success-600 h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        testStats.totalTests > 0
                          ? (testStats.passedTests / testStats.totalTests) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Charts Section - Enhanced Responsive Grid */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 lg:gap-6"
      >
        <Card shadow="soft" hover className="group overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm sm:text-base lg:text-lg" gradient>
                Performance Metrics
              </CardTitle>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Live
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            <div className="h-48 xs:h-56 sm:h-64 md:h-72 lg:h-80 xl:h-96 rounded-xl overflow-hidden bg-gradient-to-br from-gray-50/50 to-transparent dark:from-gray-800/50 p-2 sm:p-4">
              <MetricsChart />
            </div>
          </CardContent>
        </Card>

        <Card shadow="soft" hover className="group overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm sm:text-base lg:text-lg" gradient>
                Compliance Breakdown
              </CardTitle>
              <div className="px-3 py-1 bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300 rounded-full text-xs font-medium">
                Active
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            <div className="h-48 xs:h-56 sm:h-64 md:h-72 lg:h-80 xl:h-96 overflow-auto rounded-xl bg-gradient-to-br from-gray-50/50 to-transparent dark:from-gray-800/50 p-2 sm:p-4 custom-scrollbar">
              <ComplianceBreakdown />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Detection Summary - Responsive Layout */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm sm:text-base">
              Detection Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
              {/* Pattern Detections */}
              <div>
                <h4 className="font-semibold mb-4 text-gray-900 dark:text-white text-sm sm:text-base">
                  Pattern Detections ({totalPatternDetections})
                </h4>
                <div className="space-y-3">
                  {Object.entries(realtimeMetrics.pattern_detections)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([pattern, count]) => (
                      <div
                        key={pattern}
                        className="flex items-center justify-between"
                      >
                        <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                          {pattern.replace(/_/g, " ")}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">{count}</span>
                          <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-primary-500 h-2 rounded-full"
                              style={{
                                width: `${
                                  totalPatternDetections > 0
                                    ? (count / totalPatternDetections) * 100
                                    : 0
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Presidio Detections */}
              <div>
                <h4 className="font-semibold mb-4 text-gray-900 dark:text-white">
                  Presidio Detections ({totalPresidioDetections})
                </h4>
                <div className="space-y-3">
                  {totalPresidioDetections > 0 ? (
                    Object.entries(realtimeMetrics.presidio_detections)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 5)
                      .map(([entity, count]) => (
                        <div
                          key={entity}
                          className="flex items-center justify-between"
                        >
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {entity.replace(/_/g, " ")}
                          </span>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium">{count}</span>
                            <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className="bg-orange-500 h-2 rounded-full"
                                style={{
                                  width: `${
                                    totalPresidioDetections > 0
                                      ? (count / totalPresidioDetections) * 100
                                      : 0
                                  }%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                      Custom pattern detection system active.
                      <br />
                      Advanced Presidio ML detection available in enterprise
                      edition.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Activity */}
      <motion.div variants={itemVariants}>
        <RecentActivity />
      </motion.div>

      {/* Enhanced Quick Actions */}
      <motion.div variants={itemVariants}>
        <Card 
          shadow="soft" 
          hover 
          className="overflow-hidden bg-gradient-to-br from-white via-gray-50/50 to-white dark:from-gray-800 dark:via-gray-900/50 dark:to-gray-800"
        >
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg lg:text-xl" gradient>
                Quick Actions
              </CardTitle>
              <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                {lastUpdate ? formatters.relative(lastUpdate) : "Never"}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
              <Button 
                variant="primary" 
                onClick={handleRunTestSuite}
                size="md"
                className="w-full justify-center sm:size-lg"
                shadow="md"
              >
                <span className="hidden sm:inline">Run Full Test Suite</span>
                <span className="sm:hidden">Run Tests</span>
              </Button>
              <Button 
                variant="secondary" 
                onClick={handleViewLiveStream}
                size="md"
                className="w-full justify-center sm:size-lg"
                shadow="md"
              >
                <span className="hidden sm:inline">View Live Stream</span>
                <span className="sm:hidden">Live Stream</span>
              </Button>
              <Button 
                variant="outline" 
                onClick={handleExportAuditReport}
                size="md"
                className="w-full justify-center sm:size-lg"
                shadow="md"
              >
                <span className="hidden sm:inline">Export Audit Report</span>
                <span className="sm:hidden">Export Audit</span>
              </Button>
              <Button 
                variant="success" 
                onClick={handleSystemHealthCheck}
                size="md"
                className="w-full justify-center sm:size-lg"
                shadow="md"
              >
                <span className="hidden sm:inline">System Health Check</span>
                <span className="sm:hidden">Health Check</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Footer Info */}
      <motion.div
        variants={itemVariants}
        className="text-center text-sm text-gray-500 dark:text-gray-400"
      >
        Last updated: {formatters.relative(lastUpdate)} • 
        {isConnected ? " Connected" : " Disconnected"} • Regulated Edition
        v1.1.0
      </motion.div>
    </motion.div>
  );
};

export default Dashboard;
