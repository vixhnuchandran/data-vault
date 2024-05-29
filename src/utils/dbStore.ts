import { Client, ResultSet } from "@libsql/client"
import { S3 } from "aws-sdk"

export class dbStore {
  client: Client
  s3: S3

  constructor(client: Client) {
    this.client = client
    this.s3 = new S3({
      accessKeyId: process.env.AWS_ACCESS_KEY,
      secretAccessKey: process.env.AWS_SECRET_KEY,
      region: process.env.AWS_REGION,
    })
  }

  private async uploadToS3(
    dataset: string,
    hashedId: string,
    name: string,
    version: number,
    data: any
  ): Promise<string> {
    const originalName = data.originalname
    const currentDate = Date.now()
    const s3Key = `${dataset}/${hashedId}/${name}/${currentDate}-${originalName}`

    const s3UploadParams = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: s3Key,
      Body: data.buffer,
      ContentType: data.mimetype,
    }
    await this.s3.putObject(s3UploadParams).promise()
    console.log(`Data file "${originalName}" saved to S3 successfully.`)
    const s3Url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`
    return s3Url
  }

  private async insertData(
    dataset: string,
    hashedId: string,
    name: string,
    version: number,
    s3Url: string
  ) {
    const dataJson = { [version]: s3Url }
    const dataStr = JSON.stringify(dataJson)
    return this.client.execute({
      sql: `INSERT INTO store (dataset, id, name, data) VALUES (?, ?, ?, ?);`,
      args: [dataset, hashedId, name, dataStr],
    })
  }

  private async getExistingData(
    dataset: string,
    hashedId: string,
    name: string
  ): Promise<ResultSet> {
    try {
      const result = await this.client.execute({
        sql: `SELECT data FROM store WHERE dataset = ? AND id = ? AND name = ?`,
        args: [dataset, hashedId, name],
      })
      return result
    } catch (error) {
      console.error("Error fetching existing data:", error.message)
      throw error
    }
  }

  private async updateData(
    dataset: string,
    hashedId: string,
    name: string,
    updatedDataStr: string
  ) {
    return this.client.execute({
      sql: `UPDATE store SET data = ? WHERE dataset = ? AND id = ? AND name = ?`,
      args: [updatedDataStr, dataset, hashedId, name],
    })
  }

  public async saveData(
    dataset: string,
    hashedId: string,
    name: string,
    data: any
  ): Promise<number> {
    try {
      const existingData = await this.getExistingData(dataset, hashedId, name)

      let version = 1
      let queryResult

      if (!existingData.rows[0]) {
        const s3Url = await this.uploadToS3(
          dataset,
          hashedId,
          name,
          version,
          data
        )
        queryResult = await this.insertData(
          dataset,
          hashedId,
          name,
          version,
          s3Url
        )
      } else {
        const currDataJson = JSON.parse(String(existingData.rows[0].data))
        version = Object.keys(currDataJson).length + 1
        const s3Url = await this.uploadToS3(
          dataset,
          hashedId,
          name,
          version,
          data
        )
        currDataJson[version] = s3Url
        const updatedDataStr = JSON.stringify(currDataJson)
        queryResult = await this.updateData(
          dataset,
          hashedId,
          name,
          updatedDataStr
        )
      }

      return version
    } catch (error) {
      console.error("Error saving data:", error.message)
      throw error
    }
  }

  public async getData(
    hashedId: string,
    id: string,
    name: string,
    version?: number
  ): Promise<any> {
    try {
      const result = await this.getExistingData(hashedId, id, name)

      const currData = JSON.parse(String(result.rows[0].data))

      let data

      if (version) {
        data = currData[version]
      } else {
        const keys = Object.keys(currData)
        const highestKey = Math.max(...keys.map(Number))
        data = currData[highestKey.toString()]
      }
      return data
    } catch (error) {
      console.error("Error fetching data:", error.message)
      throw error
    }
  }

  public async hasData(
    dataset: string,
    hashedId: string,
    name: string
  ): Promise<boolean> {
    try {
      const result = await this.getExistingData(dataset, hashedId, name)

      console
      if (result.rows.length > 0) {
        const data = JSON.parse(String(result.rows[0].data))
        return Object.keys(data).length > 0
      } else {
        return false
      }
    } catch (error) {
      console.error("Error checking data existence:", error.message)
      throw error
    }
  }
}
