import { Controller, Get, Post, Param, UseInterceptors, UploadedFile, InternalServerErrorException, Req, BadRequestException, Query, Res } from '@nestjs/common';
import { GradesService } from './grades.service';
import { FileInterceptor } from '@nestjs/platform-express';
import * as XLSX from 'xlsx';
import { StudentMarksDto } from './dto/studentsMarks.dto';
import { gradeReultsRequest } from './dto/gradeReultsRequest.dto';
import { Public } from '../common/decorators/public.decorator';
import { query } from 'winston';
import { ResultsQueueProducer } from '../queue/queue.producer';
import express from 'express';
import 'multer';
import { memoryStorage } from 'multer';

@Controller('grades')
export class GradesController {
  constructor(private readonly gradesService: GradesService, private readonly queueProducer: ResultsQueueProducer) { }
  private num: number = 0;


  @Post('upload-grades-csv')
@UseInterceptors(FileInterceptor('grades', {
  storage: memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }
}))
async uploadExcelCsv(@UploadedFile() file: Express.Multer.File) {
  try {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const csvData = file.buffer.toString('utf8');
    const lines = csvData.split('\n').filter(line => line.trim() !== '');
    const headers = lines[0].split(',').map(h => h.trim());

    const data: StudentMarksDto[] = lines.slice(1).map(line => {
      const values = line.split(',');
      return headers.reduce((obj, key, i) => {
        obj[key] = values[i]?.trim() ?? '';
        return obj;
      }, {} as any);
    });

    console.log("total rows:", data.length);

    if (!data || data.length === 0) {
      throw new BadRequestException('No data found in file');
    }

    const result = await this.gradesService.createGradesFromFile(data);

    return {
      success: true,
      message: 'Grades uploaded successfully',
      data: result
    };
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new InternalServerErrorException('Failed to process file');
  }
}


  @Post('upload-grades')
  @UseInterceptors(FileInterceptor('grades', {
    storage: memoryStorage()
  }))
  async uploadExcel(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    try {

      console.log("controller")
      if (!file) {
        throw new BadRequestException('No file uploaded');
      }
      const workbook = XLSX.read(file.buffer, {
        type: 'buffer',
        cellDates: true,
        dateNF: 'yyyy-mm-dd',
        raw: false,
        sheets:0
      });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      console.log("worksheet:", worksheet); // add this
      if (!worksheet) {
        throw new BadRequestException('Worksheet is undefined');
      }
      console.log("file size:", file.size);
      console.log("sheet names:", workbook.SheetNames);
      console.log("worksheet keys:", Object.keys(worksheet).slice(0, 10));

      const data: StudentMarksDto[] = XLSX.utils.sheet_to_json(worksheet);

      console.log(sheetName, worksheet, data.length);
      if (!data || data.length === 0) {
        console.log("no data")
        throw new BadRequestException('No data found in Excel file');
      }

      console.log("controller2")

      const result = await this.gradesService.createGradesFromFile(data);

      return {
        success: true,
        message: 'Grades uploaded successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to process Excel file');
    }
  }

  @Public()
  @Get('view-cached-results')
  async viewCachedResults(@Query() query: gradeReultsRequest) {
    try {
      const result = await this.gradesService.viewCachedResults(query);


      console.log("iteration...", this.num);
      this.num = this.num + 1;
      return {
        success: true,
        message: 'Results retrieved successfully',
        data: result
      };
    } catch (error) {
      console.error('View results error:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException({
        success: false,
        message: 'Failed to retrieve results',
      });
    }
  }

  @Public()
  @Get('view-cached-results-que')
  async viewcachedResultsWithQueue(
    @Query() query: gradeReultsRequest,
    @Res() res: express.Response,
  ) {
    try {

      const { jobId, queued, position } = await this.queueProducer.addToQueue(
        query.student_number,
        query.date_of_birth,
      );
      // console.log(process.pid);

      res.status(202).json({
        success: true,
        message: 'Request queued for processing',
        data: {
          jobId,
          queued,
          position,
          statusUrl: `/grades/queue/status/${jobId}`,
          estimatedWaitTime: position * 0.5,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage === 'Queue full - try again later') {
        res.status(503).json({
          success: false,
          message: 'Server is busy. Please try again later.',
          queueFull: true,
        });
      } else {
        console.error('Queue error:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to queue request',
        });
      }
    }
  }

  @Public()
  @Get('queue/status/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {

    // console.log(`Worker ${process.pid} handled request`);
    const job = await this.queueProducer.getJob(jobId);

    console.log(this.num);
    this.num = this.num + 1;
    if (!job) {
      return {
        success: false,
        message: 'Job not found',
        jobId,
        status: 'not_found',
      };
    }

    const state = await job.getState();
    const progress = job.progress();
    const result = job.returnvalue;

    return {
      success: true,
      jobId,
      status: state,
      progress,
      result: state === 'completed' ? result : undefined,
      message: state === 'completed'
        ? 'Results ready'
        : state === 'failed'
          ? 'Processing failed'
          : 'Processing in progress',
    };
  }

  @Public()
  @Get('view-uncached-results-direct')
  async viewUncachedResultsDirect(@Query() query: gradeReultsRequest) {
    try {
      // Direct processing (original behavior)
      const result = await this.gradesService.viewUncachedResults(query);

      return {
        success: true,
        message: 'Results retrieved successfully',
        data: result
      };
    } catch (error) {
      console.error('View results error:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException({
        success: false,
        message: 'Failed to retrieve results',
      });
    }
  }


  @Public()
  @Post('pre-cache-results')
  async preCacheResults() {
    try {
      await this.gradesService.preLoadResultsFromDbToCache()
    } catch (error) {
      console.error(error)
    }
  }

}
