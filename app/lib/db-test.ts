import { connectToDatabase, query } from "./db";
import { DatabaseAccess } from "./db-access";

async function testDatabase() {
  try {
    // 设置环境变量
    process.env.DB_HOST = "192.168.88.102";
    process.env.DB_PORT = "5432";
    process.env.DB_NAME = "github-analyzer";
    process.env.DB_USER = "postgres";
    process.env.DB_PASSWORD = "123456";

    // 测试数据库连接
    console.log("测试数据库连接...");
    await connectToDatabase();
    console.log("数据库连接成功！");

    // 测试创建表
    console.log("创建测试表...");
    await query(`
      CREATE TABLE IF NOT EXISTS test_table (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("测试表创建成功！");

    // 测试插入数据
    console.log("插入测试数据...");
    const insertResult = await query(
      "INSERT INTO test_table (name) VALUES ($1) RETURNING *",
      ["测试数据"]
    );
    console.log("插入数据成功，ID:", insertResult.rows[0].id);

    // 测试查询数据
    console.log("查询测试数据...");
    const selectResult = await query("SELECT * FROM test_table WHERE id = $1", [
      insertResult.rows[0].id,
    ]);
    console.log("查询数据成功:", selectResult.rows[0]);

    // 测试DatabaseAccess类
    console.log("测试DatabaseAccess类...");
    const testProgress = await DatabaseAccess.createAnalysisProgress({
      repositoryUrl: "https://github.com/test/test",
      stage: "测试阶段",
      progress: 50,
      status: "analyzing",
      details: "测试详情",
    });
    console.log("创建分析进度成功，ID:", testProgress.id);

    const retrievedProgress = await DatabaseAccess.getAnalysisProgressById(
      testProgress.id
    );
    console.log("获取分析进度成功:", retrievedProgress);

    // 清理测试数据
    console.log("清理测试数据...");
    await query("DELETE FROM test_table WHERE id = $1", [
      insertResult.rows[0].id,
    ]);
    await query("DELETE FROM analysis_progress WHERE id = $1", [
      testProgress.id,
    ]);

    console.log("所有测试通过！");
  } catch (error) {
    console.error("测试失败:", error);
  }
}

// 运行测试
testDatabase();
