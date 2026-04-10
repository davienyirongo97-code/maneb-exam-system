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

  @Public()
  @Get('view-cached-results')
  async viewCachedResults(@Query() query: gradeReultsRequest) {
    try {
      const result = await this.gradesService.viewCachedResults(query);

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

  // New endpoint with queue support (non-blocking)
  // grades/grades.controller.ts
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

      console.log(process.pid);
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


}
