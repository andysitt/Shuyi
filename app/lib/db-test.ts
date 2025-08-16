import { connectToDatabase, query, closeDatabase } from "./db";
import { progressManager } from '@/app/service/progress-manager';
import redisClient from "./redis-client";

async function testDatabase() {
  try {
    // 设置环境变量
    process.env.DB_HOST = "192.168.88.102";
    process.env.DB_PORT = "5432";
    process.env.DB_NAME = "github-analyzer";
    process.env.DB_USER = "postgres";
    process.env.DB_PASSWORD = "123456";
    process.env.REDIS_URL = "redis://192.168.88.102:6379";

    // --- PostgreSQL Tests ---
    console.log("--- Testing PostgreSQL ---");
    console.log("测试数据库连接...");
    await connectToDatabase();
    console.log("数据库连接成功！");

    console.log("创建测试表...");
    await query(`
      CREATE TABLE IF NOT EXISTS test_table (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("测试表创建成功！");

    console.log("插入测试数据...");
    const insertResult = await query(
      "INSERT INTO test_table (name) VALUES ($1) RETURNING *",
      ["测试数据"]
    );
    console.log("插入数据成功，ID:", insertResult.rows[0].id);

    console.log("查询测试数据...");
    const selectResult = await query("SELECT * FROM test_table WHERE id = $1", [
      insertResult.rows[0].id,
    ]);
    console.log("查询数据成功:", selectResult.rows[0]);

    console.log("清理PostgreSQL测试数据...");
    await query("DROP TABLE IF EXISTS test_table");
    console.log("PostgreSQL测试通过！");


    // --- Redis Tests (progressManager) ---
    console.log("\n--- Testing Redis via progressManager ---");
    const testRepoUrl = `https://github.com/test/test-${Date.now()}`;

    console.log(`使用测试URL: ${testRepoUrl}`);

    // Create
    let testProgress = await progressManager.create(testRepoUrl);
    console.log("创建分析进度成功:", testProgress);

    // Update
    await progressManager.update(testRepoUrl, {
        stage: "测试阶段",
        progress: 50,
        status: "analyzing",
        details: "测试详情",
    });

    // Get
    let retrievedProgress = await progressManager.get(testRepoUrl);
    console.log("获取分析进度成功:", retrievedProgress);
    if (retrievedProgress?.progress !== 50) {
        throw new Error("获取到的进度值不匹配!");
    }

    // Update again
    const updatedProgress = await progressManager.update(
        testRepoUrl,
        { progress: 75, stage: "更新阶段" }
    );
    console.log("更新分析进度成功:", updatedProgress);
    if (updatedProgress?.progress !== 75) {
        throw new Error("更新后的进度值不匹配!");
    }

    // Delete
    await progressManager.delete(testRepoUrl);
    console.log("删除分析进度成功");

    // Get after delete
    const deletedProgress = await progressManager.get(testRepoUrl);
    if (deletedProgress) {
        throw new Error("进度删除后仍能获取到!");
    }
    console.log("确认进度已删除");
    console.log("Redis测试通过！");


    console.log("\n所有测试通过！");
  } catch (error) {
    console.error("测试失败:", error);
    process.exit(1); // Exit with error code
  } finally {
    // Close connections
    await closeDatabase();
    await redisClient.quit();
  }
}

// 运行测试
testDatabase();
