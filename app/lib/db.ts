import { Pool, QueryResult } from "pg";

// 数据库连接配置
const pool = new Pool({
  host: process.env.DB_HOST || "192.168.88.102",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || "github-analyzer",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "123456",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// 测试数据库连接
export async function connectToDatabase() {
  try {
    const client = await pool.connect();
    console.log("数据库连接成功");
    client.release();
    return pool;
  } catch (err) {
    console.error("数据库连接失败:", err);
    throw err;
  }
}

// 执行查询的辅助函数
export async function query(
  text: string,
  params?: any[]
): Promise<QueryResult> {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log("执行查询", { text, duration, rows: res.rowCount });
    return res;
  } catch (err) {
    const duration = Date.now() - start;
    console.error("查询执行失败", { text, duration, error: err });
    throw err;
  }
}

// 关闭数据库连接池
export async function closeDatabase() {
  await pool.end();
}

export { pool };
