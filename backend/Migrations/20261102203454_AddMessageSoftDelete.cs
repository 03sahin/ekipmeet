using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EkipMeet.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMessageSoftDelete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "ChatMessageId",
                table: "Notifications",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "ChatMessages",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_ChatMessageId",
                table: "Notifications",
                column: "ChatMessageId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Notifications_ChatMessageId",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "ChatMessageId",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "ChatMessages");
        }
    }
}
