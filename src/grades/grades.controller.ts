import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, InternalServerErrorException, Req, BadRequestException, Query, Res } from '@nestjs/common';
import { GradesService } from './grades.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import * as XLSX from 'xlsx';
import { StudentMarksDto } from './dto/studentsMarks.dto';
import { gradeReultsRequest } from './dto/gradeReultsRequest.dto';
import { Public } from '../common/decorators/public.decorator';
import { query } from 'winston';
import { ResultsQueueProducer } from '../queue/queue.producer';
import express from 'express';
import 'multer';

@Controller('grades')
export class GradesController {
  constructor(private readonly gradesService: GradesService, private readonly queueProducer: ResultsQueueProducer) { }



  // Endpoint to check job status
  @Public()
  @Get('queue/status/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {

    // console.log(`Worker ${process.pid} handled request`);
    const job = await this.queueProducer.getJob(jobId);

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
  @Post('pre-cache-results')
  async preCacheResults() {
    try {
      await this.gradesService.preLoadResultsFromDbToCache()
    } catch (error) {
      console.error(error)
    }
  }
}
